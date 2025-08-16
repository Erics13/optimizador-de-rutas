
import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import type { Zone } from '../types';
import { MapIcon, TableIcon, ExportIcon, ShareIcon, CheckCircleIcon, CogIcon } from './icons';
import { RouteMap } from './RouteMap';
import { generateStandaloneHTML } from '../services/htmlGenerator';

interface ZoneOptimizerProps {
  zoneData: Zone;
}

const generateRouteFilename = (zoneData: Zone): string => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${day}_${month}_${year}`;

    const nameMatch = zoneData.name.match(/Hoja de Ruta (\d+)/);
    const routeNumber = nameMatch ? nameMatch[1] : 'N/A';
    
    if (zoneData.cabinetData) {
        const accountNumber = zoneData.cabinetData.accountNumber;
        return `HR_${routeNumber}_MAX_PRIORIDAD_Posible_falla_en_Tablero_Cuenta_${accountNumber}_${dateString}`;
    }

    if (zoneData.name.includes('POSIBLE FALLA DE RAMAL/FASE')) {
        const accountMatch = zoneData.name.match(/Cuenta: (\w+)/);
        const accountNumber = accountMatch ? accountMatch[1] : 'SIN_CUENTA';
        return `HR_${routeNumber}_POSIBLE_FALLA_RAMAL_Cuenta_${accountNumber}_${dateString}`;
    }

    if (zoneData.isCabinetRoute) {
        const accountMatch = zoneData.name.match(/Cuenta: (\w+)/);
        const accountNumber = accountMatch ? accountMatch[1] : 'SIN_CUENTA';

        if (zoneData.name.includes('Evento de Voltaje')) {
            return `HR_${routeNumber}_Evento_de_Voltaje_Cuenta_${accountNumber}_${dateString}`;
        }
        if (zoneData.name.includes('Acumulación de fallas en un circuito')) {
            return `HR_${routeNumber}_Acumulacion_Fallas_Circuito_Cuenta_${accountNumber}_${dateString}`;
        }
        
        // Fallback for other potential cabinet routes
        return `HR_${routeNumber}_Evento_de_Tablero_Cuenta_${accountNumber}_${dateString}`;
    } else {
        const zoneNameMatch = zoneData.name.match(/-\s*(.*?)(?:\s\(|$)/);
        const zoneName = zoneNameMatch ? zoneNameMatch[1].trim() : `Zona Desconocida`;
        const situationMatch = zoneData.name.match(/\((.*?)\)/);
        const situation = situationMatch ? `_${situationMatch[1].replace(/\s+/g, '_')}` : '';
        return `HR ${routeNumber} - ${zoneName}${situation} - ${dateString}`;
    }
};

const translateCategory = (category: string): string => {
    if (!category) return '';
    const lowerCategory = category.toLowerCase().trim();
    const translations: { [key: string]: string } = {
        'unspecific warning': 'Advertencia no específica',
        'broken': 'Roto',
        'unreachable': 'Inaccesible',
        'inconsistent': 'Inconsistente',
    };
    return translations[lowerCategory] || category;
};

const formatTension = (tension?: string): string => {
    if (!tension) return 'N/A';
    const tensionStr = String(tension).trim();
    if (tensionStr.match(/v$/i)) {
        return tensionStr;
    }
    return `${tensionStr}V`;
};

const captureMapImage = (
  map: L.Map,
  element: HTMLElement,
  zoneData: Zone
): Promise<string | null> => {
  return new Promise((resolve) => {
    const route = zoneData.optimizedRoute;
    if (!route || route.length === 0) {
      resolve(null);
      return;
    }

    const eventPositions: L.LatLngTuple[] = route.map((event) => [event.lat, event.lon]);
    if (zoneData.cabinetData) {
        eventPositions.push([zoneData.cabinetData.lat, zoneData.cabinetData.lon]);
    }
    const bounds = L.latLngBounds(eventPositions);

    map.invalidateSize();

    map.once("moveend", async () => {
      await new Promise((res) => setTimeout(res, 500)); 

      try {
        const canvas = await html2canvas(element, {
          useCORS: true,
          logging: false,
          scale: 2,
        });
        resolve(canvas.toDataURL("image/png"));

      } catch (err) {
        console.error("Error al generar la imagen del mapa con html2canvas:", err);
        resolve(null);
      }
    });
    
    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [25, 25] });
    } else {
        console.warn("No se pudieron crear límites válidos para el mapa del PDF.");
        resolve(null);
    }
  });
};

const exportToPDF = async (
  zoneData: Zone, 
  mapInstance: L.Map | null,
  mapElement: HTMLElement | null
) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = zoneData.name;
    const filename = `${generateRouteFilename(zoneData)}.pdf`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 14, 22);
    
    if (zoneData.priority === 1 && zoneData.cabinetData) {
        const cabinet = zoneData.cabinetData;
        const body = [
            ['Nro. de Cuenta', cabinet.accountNumber],
            ['Dirección', cabinet.direccion || 'N/A'],
            ['Tensión', formatTension(cabinet.tension)],
            ['Tarifa', cabinet.tarifa || 'N/A'],
            ['Pot. Contratada', cabinet.potContrat || 'N/A'],
            ['Luminarias Afectadas', cabinet.affectedLuminaires.length.toString()],
        ];

        autoTable(doc, {
            startY: 30,
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
            body: body,
            didDrawPage: (data) => {
                const str = `Página ${data.pageNumber}`;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
                doc.text(str, data.settings.margin.left, pageHeight - 10);
            }
        });

    } else {
        const route = zoneData.optimizedRoute;
        if (!route || route.length === 0) return;

        const tableColumn = ["#", "ID Luminaria / OLC", "ID Gabinete", "Potencia", "Fecha Reporte", "Categoría", "Situación", "Mensaje de Error", "Actuación / Observaciones"];
        const tableRows: (string|number)[][] = [];

        route.forEach((event, index) => {
            tableRows.push([
                index + 1,
                `${event.luminaireId}\n${event.olcId || 'N/A'}`,
                event.cabinetId || 'N/A',
                `${event.power} W`,
                event.reportedDate || 'N/A',
                translateCategory(event.category) || 'N/A',
                event.situation || 'N/A',
                event.errorMessage || 'N/A',
                ''
            ]);
        });

        const headFillColor: [number, number, number] = zoneData.isCabinetRoute ? [249, 115, 22] : [75, 85, 99];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: headFillColor, textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { font: 'helvetica', cellPadding: 2.5, fontSize: 8, valign: 'middle' },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 45 }, 2: { cellWidth: 20 }, 3: { cellWidth: 15 }, 4: { cellWidth: 20 }, 5: { cellWidth: 25 }, 6: { cellWidth: 25 }, 7: { cellWidth: 35 }, 8: { cellWidth: 'auto' } },
            didParseCell: (data) => { if (data.section === 'body' && data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; } },
            didDrawPage: (data) => {
                const str = `Página ${data.pageNumber}`;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
                doc.text(str, data.settings.margin.left, pageHeight - 10);
            }
        });
    }
    
    const mapImage = mapInstance && mapElement ? await captureMapImage(mapInstance, mapElement, zoneData) : null;
    if (mapImage) {
        doc.addPage('landscape');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("Mapa de la Ruta", 14, 22);

        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - 40;

        const imgProps = doc.getImageProperties(mapImage);
        const ratio = imgProps.width / imgProps.height;
        
        let pdfImgWidth = availableWidth;
        let pdfImgHeight = pdfImgWidth / ratio;

        if (pdfImgHeight > availableHeight) {
            pdfImgHeight = availableHeight;
            pdfImgWidth = pdfImgHeight * ratio;
        }

        const x = (pageWidth - pdfImgWidth) / 2;
        const y = 30;
        doc.addImage(mapImage, 'PNG', x, y, pdfImgWidth, pdfImgHeight);
        
        const str = `Página ${doc.getNumberOfPages()}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(str, margin, pageHeight - 10);
    }

    doc.save(filename);
};

export const ZoneOptimizer: React.FC<ZoneOptimizerProps> = ({ zoneData }) => {
  const route = zoneData.optimizedRoute || [];
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'generating' | 'success'>('idle');

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportToPDF(zoneData, mapInstance, mapContainerRef.current);
    } catch(err) {
      console.error("Error al exportar a PDF:", err);
      alert("Ocurrió un error al exportar el PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (shareStatus === 'generating') return;
    setShareStatus('generating');

    try {
      const htmlContent = generateStandaloneHTML(zoneData);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const filename = `${generateRouteFilename(zoneData)}.html`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShareStatus('success');
      setTimeout(() => setShareStatus('idle'), 3000);

    } catch (error) {
        console.error("Error al generar el archivo HTML:", error);
        alert("Ocurrió un error al generar el archivo para compartir.");
        setShareStatus('idle');
    }
  };
  
  const isMaxPriority = zoneData.priority === 1 && zoneData.cabinetData;
  const isHighPriority = zoneData.isCabinetRoute && !isMaxPriority;
  
  let titleClass = 'text-indigo-700';
  let theadClass = 'bg-slate-100';
  let headerTextClass = 'text-slate-500';

  if (isMaxPriority) {
      titleClass = 'text-red-700';
      theadClass = 'bg-red-100';
      headerTextClass = 'text-red-800';
  } else if (isHighPriority) {
      titleClass = 'text-amber-800';
      theadClass = 'bg-amber-100';
      headerTextClass = 'text-amber-800';
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 bg-slate-50 border-b border-slate-200">
        <h3 className={`text-xl font-bold ${titleClass}`}>{zoneData.name}</h3>
        <p className="text-sm text-slate-500 mt-1">
          Total de eventos en esta hoja de ruta: {route.length}
        </p>
      </div>

      <div className="p-6 grid grid-cols-1 gap-8">
        <div>
          <div className="flex justify-between items-center mb-3">
              <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-700">
                  <TableIcon className="h-5 w-5" />
                  {isMaxPriority ? 'Resumen del Tablero Afectado' : 'Hoja de Ruta'}
              </h4>
              <div className="flex items-center gap-4">
                  <button
                      onClick={handleShare}
                      disabled={shareStatus === 'generating'}
                      className={`flex items-center gap-1.5 text-xs font-semibold disabled:cursor-not-allowed transition-all duration-200 ${
                        shareStatus === 'success' 
                        ? 'text-green-600'
                        : 'text-slate-600 hover:text-indigo-600 disabled:text-slate-400'
                      }`}
                      title={shareStatus === 'success' ? "¡Archivo HTML generado!" : "Generar un archivo HTML para compartir"}
                  >
                      {shareStatus === 'idle' && <><ShareIcon className="h-4 w-4" />Compartir</>}
                      {shareStatus === 'generating' && <><CogIcon className="h-4 w-4 animate-spin" />Generando...</>}
                      {shareStatus === 'success' && <><CheckCircleIcon className="h-4 w-4" />¡Archivo Generado!</>}
                  </button>
                  <button
                      onClick={handleExport}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                      title="Exportar hoja de ruta a PDF"
                  >
                      <ExportIcon className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
                      {isExporting ? 'Exportando...' : 'Exportar a PDF'}
                  </button>
              </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
             {isMaxPriority && zoneData.cabinetData ? (
                 <table className="min-w-full">
                     <thead className={theadClass}>
                         <tr>
                             <th scope="col" className={`w-1/3 px-4 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Propiedad</th>
                             <th scope="col" className={`px-4 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Valor</th>
                         </tr>
                     </thead>
                     <tbody className="bg-white divide-y divide-slate-200">
                         <tr className="bg-red-50"><td className="px-4 py-3 text-sm font-semibold text-slate-800">Nro. de Cuenta</td><td className="px-4 py-3 text-sm font-bold text-slate-900">{zoneData.cabinetData.accountNumber}</td></tr>
                         <tr><td className="px-4 py-3 text-sm font-semibold text-slate-800">Dirección</td><td className="px-4 py-3 text-sm text-slate-600">{zoneData.cabinetData.direccion || 'N/A'}</td></tr>
                         <tr className="bg-red-50"><td className="px-4 py-3 text-sm font-semibold text-slate-800">Tensión</td><td className="px-4 py-3 text-sm text-slate-600">{formatTension(zoneData.cabinetData.tension)}</td></tr>
                         <tr><td className="px-4 py-3 text-sm font-semibold text-slate-800">Tarifa</td><td className="px-4 py-3 text-sm text-slate-600">{zoneData.cabinetData.tarifa || 'N/A'}</td></tr>
                         <tr className="bg-red-50"><td className="px-4 py-3 text-sm font-semibold text-slate-800">Pot. Contratada</td><td className="px-4 py-3 text-sm text-slate-600">{zoneData.cabinetData.potContrat || 'N/A'}</td></tr>
                         <tr><td className="px-4 py-3 text-sm font-semibold text-slate-800">Luminarias Afectadas</td><td className="px-4 py-3 text-sm font-bold text-red-600">{zoneData.cabinetData.affectedLuminaires.length}</td></tr>
                     </tbody>
                 </table>
             ) : (
                <table className="min-w-full divide-y divide-slate-200 table-fixed">
                  <thead className={theadClass}>
                      <tr>
                        <th scope="col" className={`w-12 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>#</th>
                        <th scope="col" className={`w-44 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>ID Luminaria / OLC</th>
                        <th scope="col" className={`w-32 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>ID Gabinete</th>
                        <th scope="col" className={`w-24 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Potencia</th>
                        <th scope="col" className={`w-32 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Fecha Reporte</th>
                        <th scope="col" className={`w-32 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Categoría</th>
                        <th scope="col" className={`w-32 px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Situación</th>
                        <th scope="col" className={`px-3 py-3 text-left text-xs font-medium ${headerTextClass} uppercase tracking-wider`}>Mensaje de Error</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                      {route.length > 0 ? route.map((event, index) => {
                          const rowClass = isHighPriority ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50';
                          return (
                            <tr key={event._internal_id || `event-${index}`} className={rowClass}>
                                <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-800 align-top">{index + 1}</td>
                                <td className="px-3 py-3 text-sm font-bold text-black align-top">
                                    {event.luminaireId || 'N/A'}
                                    <div className="mt-1 text-sm font-bold text-black">{event.olcId || 'N/A'}</div>
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-600 align-top">{event.cabinetId || 'N/A'}</td>
                                <td className="px-3 py-3 text-sm text-slate-600 align-top">{`${event.power} W`}</td>
                                <td className="px-3 py-3 text-sm text-slate-600 align-top">{event.reportedDate || 'N/A'}</td>
                                <td className="px-3 py-3 text-sm text-slate-600 align-top">{translateCategory(event.category) || 'N/A'}</td>
                                <td className="px-3 py-3 text-sm text-slate-600 align-top">
                                {(() => {
                                    const situation = event.situation;
                                    if (!situation || situation === 'N/A' || situation.trim() === '-') return <span className="text-slate-500">-</span>;
                                    const lowerSit = situation.toLowerCase();
                                    let colorClasses = 'bg-slate-100 text-slate-800';
                                    if (lowerSit.includes('vandaliza') || lowerSit.includes('hurto') || lowerSit.includes('columna caida')) colorClasses = 'bg-red-100 text-red-800 font-bold';
                                    else if (lowerSit.includes('falta poda') || lowerSit.includes('sin energia')) colorClasses = 'bg-yellow-100 text-yellow-800';
                                    else if (lowerSit.includes('retirada')) colorClasses = 'bg-blue-100 text-blue-800';
                                    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses}`}>{situation}</span>;
                                })()}
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-600 align-top">
                                <div className={`px-2 py-1 text-xs rounded-md ${event.errorMessage ? 'bg-red-100 text-red-800' : 'text-slate-500'}`}>{event.errorMessage || 'N/A'}</div>
                                </td>
                            </tr>
                          )
                      }) : (
                      <tr><td colSpan={8} className="text-center py-4 text-sm text-slate-500">No hay datos de ruta para mostrar.</td></tr>
                      )}
                  </tbody>
                </table>
             )}
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-3">
              <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-700">
                  <MapIcon className="h-5 w-5" />
                  Mapa de la Hoja de Ruta
              </h4>
          </div>
          <div ref={mapContainerRef} className="h-[600px] bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
            <RouteMap zoneData={zoneData} onMapReady={setMapInstance} />
          </div>
        </div>
      </div>
    </div>
  );
};
