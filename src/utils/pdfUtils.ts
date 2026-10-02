import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FPRM_LOGO_BASE64 } from '../constants';
import { PlayerRegistry } from '../../types';

export const addProfessionalHeader = (doc: jsPDF, title: string, subtitle: string) => {
    // Add a subtle top border
    doc.setFillColor(212, 33, 17); // Primary Red
    doc.rect(0, 0, 210, 5, 'F');

    // Add Logo
    try {
        doc.addImage(FPRM_LOGO_BASE64, 'PNG', 14, 10, 25, 25);
    } catch (e) {
        console.warn("Could not load logo", e);
    }

    // Title
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 45, 22);

    // Subtitle
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 45, 30);

    // Add a separator line
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);
};

export const addProfessionalFooter = (doc: jsPDF, documentName: string) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    const date = new Date().toLocaleDateString('es-ES', { 
        year: 'numeric', month: 'long', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Add a separator line
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.5);
        doc.line(14, 285, 196, 285);

        // Footer text
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'italic');
        
        // Left side: Document name & Date
        doc.text(`${documentName} - Generado el ${date}`, 14, 290);
        
        // Right side: Page number
        doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' });

        // Bottom right: Author
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text(`Hecho por: Jose garcia`, 196, 294, { align: 'right' });
    }
};

export const getProfessionalTableStyles = () => {
    return {
        theme: 'grid' as const,
        headStyles: { 
            fillColor: [245, 245, 245] as [number, number, number], 
            textColor: [40, 40, 40] as [number, number, number], 
            fontStyle: 'bold' as const, 
            halign: 'center' as const,
            lineWidth: 0.1,
            lineColor: [220, 220, 220] as [number, number, number]
        },
        bodyStyles: { 
            halign: 'center' as const, 
            valign: 'middle' as const,
            textColor: [60, 60, 60] as [number, number, number],
            lineWidth: 0.1,
            lineColor: [230, 230, 230] as [number, number, number]
        },
        alternateRowStyles: { 
            fillColor: [252, 252, 252] as [number, number, number] 
        },
        margin: { top: 45, left: 14, right: 14, bottom: 20 },
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 4
        }
    };
};

export const exportClubCredentialsPDF = (users: PlayerRegistry[]) => {
    // Group users by club
    const usersByClub: Record<string, PlayerRegistry[]> = {};
    users.forEach(user => {
        const club = user.club || 'Sin Club';
        if (!usersByClub[club]) {
            usersByClub[club] = [];
        }
        usersByClub[club].push(user);
    });

    const doc = new jsPDF();
    const clubs = Object.keys(usersByClub).sort();

    clubs.forEach((club, index) => {
        if (index > 0) {
            doc.addPage();
        }

        addProfessionalHeader(doc, `Credenciales de Acceso`, `Club: ${club}`);

        const tableData = usersByClub[club].map(user => [
            user.name,
            user.license || '-',
            user.username,
            user.password || 'Generada automáticamente'
        ]);

        autoTable(doc, {
            ...getProfessionalTableStyles(),
            head: [['Nombre', 'Licencia', 'Usuario', 'Contraseña']],
            body: tableData,
            startY: 45,
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'left', fontStyle: 'bold' },
                3: { halign: 'left', fontStyle: 'italic', textColor: [100, 100, 100] }
            }
        });
    });

    addProfessionalFooter(doc, 'Listado de Credenciales por Club');
    doc.save('Credenciales_Clubes.pdf');
};
