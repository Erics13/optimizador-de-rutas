
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
    const bounds = L.latLngBounds(eventPositions);

    map.invalidateSize();

    map.once("moveend", async () => {
      await new Promise((res) => setTimeout(res, 1000));

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
        map.fitBounds(bounds, { padding: [15, 15] });
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
    const route = zoneData.optimizedRoute;
    const zoneName = zoneData.name;
    if (!route || route.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });

    // --- PAGE 1: TABLE ---
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${day}-${month}-${year}`;

    const routeNameRegex = /(.*) - Hoja de Ruta (\d+)/;
    const match = zoneName.match(routeNameRegex);
    const baseName = match ? match[1].trim() : zoneName;
    const routeNumber = match ? match[2] : '1';
    
    const sanitizedBaseName = baseName.replace(/[:()]/g, '').replace(/\s+/g, ' ').trim();
    const title = `HR ${routeNumber} ${sanitizedBaseName} ${dateString}`;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 14, 22);
    
    const tableColumn = ["#", "ID Luminaria / Tablero", "ID Antena", "ID Gabinete", "Pot(w)", "Fecha Reporte", "Categoría", "Situación", "Mensaje de Error", "Actuación / Observaciones"];
    const tableRows: (string|number)[][] = [];

    route.forEach((event, index) => {
        tableRows.push(event.isCabinetEvent ? [
            index + 1, event.luminaireId, 'N/A', 'N/A', event.power,
            event.reportedDate || 'N/A', event.category, 'N/A',
            event.errorMessage || 'N/A', ''
        ] : [
            index + 1, event.luminaireId || 'N/A', event.olcId || 'N/A', event.cabinetId || 'N/A',
            event.power, event.reportedDate || 'N/A', translateCategory(event.category) || 'N/A',
            event.situation || 'N/A', event.errorMessage || 'N/A', ''
        ]);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: 'helvetica', cellPadding: 2.5, fontSize: 8, valign: 'middle' },
        columnStyles: {
            0: { cellWidth: 8 },    // #
            1: { cellWidth: 38 },   // ID Luminaria / Tablero
            2: { cellWidth: 38 },   // ID Antena
            3: { cellWidth: 20 },   // ID Gabinete
            4: { cellWidth: 12 },   // Pot(w)
            5: { cellWidth: 20 },   // Fecha Reporte
            6: { cellWidth: 20 },   // Categoría
            7: { cellWidth: 20 },   // Situación
            8: { cellWidth: 35 },   // Mensaje de Error (Reduced width)
            9: { cellWidth: 'auto' }, // Actuación / Observaciones
        },
        didParseCell: (data) => {
            if (data.section === 'body' && (data.column.index === 1 || data.column.index === 2)) {
                data.cell.styles.fontStyle = 'bold';
            }
        },
        didDrawPage: (data) => {
            const str = `Página ${data.pageNumber}`;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.text(str, data.settings.margin.left, pageHeight - 10);
        }
    });

    // --- PAGE 2: MAP ---
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
        const availableHeight = pageHeight - 40; // Space for title and footer

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

        // Add footer to map page
        const str = `Página 2`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(str, margin, pageHeight - 10);
    }

    const filename = `${title}.pdf`;
    doc.save(filename);
};

export const ZoneOptimizer: React.FC<ZoneOptimizerProps> = ({ zoneData }) => {
  const route = zoneData.optimizedRoute || [];
  const totalEvents = route.length;
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'generating' | 'success'>('idle');

  const handleExport = async () => {
    if (route.length === 0 || isExporting) return;
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
    if (route.length === 0 || shareStatus === 'generating') return;
    setShareStatus('generating');

    try {
      const htmlContent = generateStandaloneHTML(zoneData);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const zoneName = zoneData.name;
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const dateString = `${day}-${month}-${year}`;

      const routeNameRegex = /(.*) - Hoja de Ruta (\d+)/;
      const match = zoneName.match(routeNameRegex);
      const baseName = match ? match[1].trim() : zoneName;
      const routeNumber = match ? match[2] : '1';
      
      const sanitizedBaseName = baseName.replace(/[:()]/g, '').replace(/\s+/g, ' ').trim();
      
      const filename = `HR ${routeNumber} ${sanitizedBaseName} ${dateString}.html`;

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


  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="p-6 bg-slate-50 border-b border-slate-200">
        <h3 className="text-xl font-bold text-indigo-700">{zoneData.name}</h3>
        <p className="text-sm text-slate-500 mt-1">
          Total de eventos en esta hoja de ruta: {totalEvents}
        </p>
      </div>

      <div className="p-6 grid grid-cols-1 gap-8">
        <div>
          <div className="flex justify-between items-center mb-3">
              <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-700">
                  <TableIcon className="h-5 w-5" />
                  Hoja de Ruta
              </h4>
              <div className="flex items-center gap-4">
                  <button
                      onClick={handleShare}
                      disabled={route.length === 0 || shareStatus === 'generating'}
                      className={`flex items-center gap-1.5 text-xs font-semibold disabled:cursor-not-allowed transition-all duration-200 ${
                        shareStatus === 'success' 
                        ? 'text-green-600'
                        : 'text-slate-600 hover:text-indigo-600 disabled:text-slate-400'
                      }`}
                      title={shareStatus === 'success' ? "¡Archivo HTML generado!" : "Generar un archivo HTML para compartir"}
                  >
                      {shareStatus === 'idle' && (
                          <>
                              <ShareIcon className="h-4 w-4" />
                              Compartir
                          </>
                      )}
                      {shareStatus === 'generating' && (
                          <>
                              <CogIcon className="h-4 w-4 animate-spin" />
                              Generando...
                          </>
                      )}
                      {shareStatus === 'success' && (
                          <>
                              <CheckCircleIcon className="h-4 w-4" />
                              ¡Archivo Generado!
                          </>
                      )}
                  </button>
                  <button
                      onClick={handleExport}
                      disabled={route.length === 0 || isExporting}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                      title="Exportar hoja de ruta a PDF"
                  >
                      <ExportIcon className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
                      {isExporting ? 'Exportando...' : 'Exportar a PDF'}
                  </button>
              </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 table-fixed">
              <thead className="bg-slate-100">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                  <th scope="col" className="w-44 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Luminaria / Tablero</th>
                  <th scope="col" className="w-44 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Antena</th>
                  <th scope="col" className="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID Gabinete</th>
                  <th scope="col" className="w-24 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Potencia (W)</th>
                  <th scope="col" className="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha Reporte</th>
                  <th scope="col" className="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                  <th scope="col" className="w-32 px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Situación</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mensaje de Error</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {route.length > 0 ? route.map((event, index) => (
                  event.isCabinetEvent ? (
                      <tr key={event._internal_id || `cabinet-${index}`} className="bg-amber-50 hover:bg-amber-100">
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-amber-900 align-top">{index + 1}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-amber-900 align-top">{event.luminaireId}</td>
                        <td className="px-3 py-3 text-sm text-amber-700 align-top">N/A</td>
                        <td className="px-3 py-3 text-sm text-amber-700 align-top">N/A</td>
                        <td className="px-3 py-3 text-sm text-amber-700 align-top">{event.power}</td>
                        <td className="px-3 py-3 text-sm text-amber-700 align-top">{event.reportedDate || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm text-amber-700 align-top">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-200 text-amber-800">
                            {event.category}
                          </span>
                        </td>
                         <td className="px-3 py-3 text-sm text-amber-700 align-top">N/A</td>
                        <td className="px-3 py-3 text-sm text-amber-700 align-top">{event.errorMessage}</td>
                      </tr>
                    ) : (
                      <tr key={event._internal_id || `event-${index}`} className="hover:bg-slate-50">
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-slate-800 align-top">{index + 1}</td>
                        <td className="px-3 py-3 text-sm font-bold text-slate-700 align-top">{event.luminaireId || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm font-bold text-slate-700 align-top">{event.olcId || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 align-top">{event.cabinetId || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 align-top">{event.power}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 align-top">{event.reportedDate || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 align-top">{translateCategory(event.category) || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600 align-top">
                          {(() => {
                              const situation = event.situation;
                              if (!situation || situation === 'N/A') {
                                  return <span className="text-slate-500">-</span>;
                              }

                              const lowerSit = situation.toLowerCase();
                              let colorClasses = 'bg-slate-100 text-slate-800';
                              
                              if (lowerSit.includes('vandaliza') || lowerSit.includes('hurto') || lowerSit.includes('columna caida')) {
                                  colorClasses = 'bg-red-100 text-red-800 font-bold';
                              } else if (lowerSit.includes('falta poda') || lowerSit.includes('sin energia')) {
                                  colorClasses = 'bg-yellow-100 text-yellow-800';
                              } else if (lowerSit.includes('retirada')) {
                                  colorClasses = 'bg-blue-100 text-blue-800';
                              }

                              return (
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses}`}>
                                      {situation}
                                  </span>
                              );
                          })()}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600 align-top">
                           <div className={`px-2 py-1 text-xs rounded-md ${event.errorMessage ? 'bg-red-100 text-red-800' : 'text-slate-500'}`}>
                            {event.errorMessage || 'N/A'}
                          </div>
                        </td>
                      </tr>
                    )
                )) : (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-sm text-slate-500">No hay datos de ruta para mostrar.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
