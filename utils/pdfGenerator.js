// ===================== pdfGenerator.js (ENHANCED) =====================
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate comprehensive prescription PDF with all details
 * @param {Object} prescriptionData - Complete prescription details
 * @param {Object} doctorData - Doctor details
 * @param {Object} patientData - Patient details
 * @returns {Promise<string>} - Path to generated PDF
 */
export const generatePrescriptionPDF = async (prescriptionData, doctorData, patientData) => {
  return new Promise((resolve, reject) => {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads/prescriptions');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate filename
      const filename = `prescription_${prescriptionData.id}_${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);

      // Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // Pipe to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // ========== HEADER SECTION ==========
      doc.fontSize(22).fillColor('#1E40AF').font('Helvetica-Bold')
         .text('PRESCRIPTION', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#6B7280').font('Helvetica')
         .text(`Prescription ID: ${prescriptionData.id}`, { align: 'center' });
      doc.moveDown(1);

      // ========== CLINIC INFORMATION (if available) ==========
      if (prescriptionData.clinic_name) {
        doc.rect(50, doc.y, 495, 60).fillAndStroke('#EEF2FF', '#DBEAFE');
        doc.fillColor('#1E40AF').fontSize(14).font('Helvetica-Bold')
           .text(prescriptionData.clinic_name, 60, doc.y - 50);
        
        if (prescriptionData.clinic_address) {
          doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
             .text(prescriptionData.clinic_address, 60, doc.y - 32, { width: 475 });
        }
        doc.moveDown(1.5);
      }

      // ========== DOCTOR INFORMATION ==========
      doc.rect(50, doc.y, 495, 85).fillAndStroke('#F3F4F6', '#E5E7EB');
      const doctorY = doc.y;
      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
         .text('DOCTOR INFORMATION', 60, doctorY + 10);
      
      doc.font('Helvetica').fontSize(11).fillColor('#1F2937')
         .text(`Dr. ${doctorData.name || 'Unknown'}`, 60, doctorY + 30);
      doc.fontSize(10).fillColor('#6B7280')
         .text(doctorData.specialization || 'General Practice', 60, doctorY + 45);
      
      if (doctorData.email) {
        doc.text(`Email: ${doctorData.email}`, 60, doctorY + 60);
      }
      if (doctorData.phone_number) {
        doc.text(`Phone: ${doctorData.phone_number}`, 300, doctorY + 60);
      }

      doc.moveDown(2);

      // ========== PATIENT INFORMATION ==========
      const patientY = doc.y;
      doc.rect(50, patientY, 495, 110).fillAndStroke('#F3F4F6', '#E5E7EB');
      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
         .text('PATIENT INFORMATION', 60, patientY + 10);
      
      doc.font('Helvetica').fontSize(11).fillColor('#1F2937')
         .text(`Name: ${prescriptionData.patient_name || patientData.name || 'Unknown'}`, 60, patientY + 30);
      
      // Age and Gender
      let ageGenderLine = '';
      if (prescriptionData.patient_age) ageGenderLine += `Age: ${prescriptionData.patient_age}`;
      if (prescriptionData.patient_gender) {
        if (ageGenderLine) ageGenderLine += '  |  ';
        ageGenderLine += `Gender: ${prescriptionData.patient_gender}`;
      }
      if (ageGenderLine) {
        doc.fontSize(10).fillColor('#6B7280')
           .text(ageGenderLine, 60, patientY + 45);
      }
      
      // Contact Info
      if (patientData.email) {
        doc.text(`Email: ${patientData.email}`, 60, patientY + 60);
      }
      if (patientData.phone_number) {
        doc.text(`Phone: ${patientData.phone_number}`, 300, patientY + 60);
      }

      // Drug Allergies (IMPORTANT)
      if (prescriptionData.drug_allergies) {
        doc.fontSize(10).fillColor('#DC2626').font('Helvetica-Bold')
           .text(`⚠ ALLERGIES: ${prescriptionData.drug_allergies}`, 60, patientY + 80, { width: 475 });
      }

      // Consultation Date and Mode
      const dateStr = prescriptionData.consultation_date 
        ? new Date(prescriptionData.consultation_date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          })
        : 'N/A';
      doc.fontSize(9).fillColor('#6B7280').font('Helvetica')
         .text(`Consultation: ${dateStr}${prescriptionData.consultation_mode ? ` (${prescriptionData.consultation_mode})` : ''}`, 
               60, patientY + 95);

      doc.moveDown(3);

      // ========== VITAL SIGNS ==========
      const vitals = [];
      if (prescriptionData.blood_pressure) vitals.push(`BP: ${prescriptionData.blood_pressure}`);
      if (prescriptionData.pulse) vitals.push(`Pulse: ${prescriptionData.pulse}`);
      if (prescriptionData.temperature) vitals.push(`Temp: ${prescriptionData.temperature}`);
      if (prescriptionData.spo2) vitals.push(`SpO2: ${prescriptionData.spo2}`);
      if (prescriptionData.weight) vitals.push(`Weight: ${prescriptionData.weight}kg`);
      if (prescriptionData.height) vitals.push(`Height: ${prescriptionData.height}cm`);
      if (prescriptionData.bmi) vitals.push(`BMI: ${prescriptionData.bmi}`);

      if (vitals.length > 0 || prescriptionData.custom_vitals) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('VITAL SIGNS', 50);
        doc.moveDown(0.3);
        
        const vitalsY = doc.y;
        doc.rect(50, vitalsY, 495, vitals.length > 0 ? 40 : 30)
           .fillAndStroke('#F9FAFB', '#E5E7EB');
        
        if (vitals.length > 0) {
          doc.fontSize(10).font('Helvetica').fillColor('#374151')
             .text(vitals.join('  |  '), 60, vitalsY + 10, { width: 475 });
        }
        
        if (prescriptionData.custom_vitals) {
          doc.fontSize(9).fillColor('#6B7280')
             .text(prescriptionData.custom_vitals, 60, doc.y - 15, { width: 475 });
        }
        
        doc.moveDown(1.5);
      }

      // ========== CHIEF COMPLAINTS ==========
      if (prescriptionData.chief_complaints) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('CHIEF COMPLAINTS', 50);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.chief_complaints, 50, doc.y, { 
             width: 495, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(1.5);
      }

      // ========== SYMPTOMS ==========
      if (prescriptionData.symptoms) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('SYMPTOMS', 50);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.symptoms, 50, doc.y, { 
             width: 495, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(1.5);
      }

      // ========== DIAGNOSIS ==========
      if (prescriptionData.diagnosis) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('DIAGNOSIS', 50);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.diagnosis, 50, doc.y, { 
             width: 495, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(1.5);
      }

      // ========== PRESCRIBED MEDICATIONS (Highlighted) ==========
      if (prescriptionData.medications) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('℞ PRESCRIBED MEDICATIONS', 50);
        doc.moveDown(0.5);
        
        const medTextY = doc.y;
        const medLines = doc.heightOfString(prescriptionData.medications, { width: 475 });
        doc.rect(50, medTextY - 5, 495, medLines + 20)
           .fillAndStroke('#FEFCE8', '#FDE047');
        
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.medications, 60, medTextY + 5, { 
             width: 475, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(2);
      }

      // ========== LAB TESTS ==========
      if (prescriptionData.lab_tests) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('LABORATORY TESTS', 50);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.lab_tests, 50, doc.y, { 
             width: 495, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(1.5);
      }

      // ========== GENERAL ADVICE ==========
      if (prescriptionData.general_advice) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('GENERAL ADVICE', 50);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.general_advice, 50, doc.y, { 
             width: 495, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(1.5);
      }

      // ========== FOLLOW-UP ==========
      if (prescriptionData.follow_up || prescriptionData.follow_up_date) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('FOLLOW-UP', 50);
        doc.moveDown(0.5);
        
        if (prescriptionData.follow_up_date) {
          const followUpDate = new Date(prescriptionData.follow_up_date).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E40AF')
             .text(`Next Visit: ${followUpDate}`, 50);
          doc.moveDown(0.3);
        }
        
        if (prescriptionData.follow_up) {
          doc.fontSize(11).font('Helvetica').fillColor('#374151')
             .text(prescriptionData.follow_up, 50, doc.y, { 
               width: 495, 
               align: 'left',
               lineGap: 3
             });
        }
        doc.moveDown(1.5);
      }

      // ========== REFERRAL INFORMATION ==========
      if (prescriptionData.referral_specialist || prescriptionData.referral_doctor_hospital) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('REFERRAL', 50);
        doc.moveDown(0.5);
        
        const refY = doc.y;
        doc.rect(50, refY, 495, 60).fillAndStroke('#FEF3C7', '#FDE047');
        
        if (prescriptionData.referral_specialist) {
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#92400E')
             .text(`Specialist: ${prescriptionData.referral_specialist}`, 60, refY + 10);
        }
        if (prescriptionData.referral_doctor_hospital) {
          doc.fontSize(10).font('Helvetica').fillColor('#92400E')
             .text(`Referred to: ${prescriptionData.referral_doctor_hospital}`, 60, refY + 25);
        }
        if (prescriptionData.referral_reason) {
          doc.fontSize(9).fillColor('#78350F')
             .text(`Reason: ${prescriptionData.referral_reason}`, 60, refY + 40, { width: 475 });
        }
        doc.moveDown(2);
      }

      // ========== CLINICAL NOTES ==========
      if (prescriptionData.notes) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
           .text('CLINICAL NOTES', 50);
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor('#374151')
           .text(prescriptionData.notes, 50, doc.y, { 
             width: 495, 
             align: 'left',
             lineGap: 3
           });
        doc.moveDown(1.5);
      }

      // ========== FOOTER WITH SIGNATURE ==========
      const pageHeight = doc.page.height;
      const footerY = pageHeight - 120;
      
      if (doc.y < footerY) {
        doc.y = footerY;
      }

      doc.moveDown(1);
      
      // Digital Signature if available
      if (prescriptionData.digital_signature) {
        doc.fontSize(9).fillColor('#6B7280').font('Helvetica-Oblique')
           .text('Digitally Signed', 400, doc.y);
        doc.moveDown(0.3);
      }
      
      doc.fontSize(10).fillColor('#6B7280').font('Helvetica')
         .text('_________________________', 400, doc.y);
      doc.fontSize(9).fillColor('#6B7280')
         .text(`Dr. ${doctorData.name || 'Unknown'}`, 420, doc.y + 5);
      doc.fontSize(8).fillColor('#9CA3AF')
         .text(doctorData.specialization || '', 420, doc.y + 5);

      // Disclaimer
      doc.fontSize(8).fillColor('#9CA3AF').font('Helvetica')
         .text('This is a computer-generated prescription. Please consult your doctor for any clarifications.', 
               50, pageHeight - 50, { 
                 align: 'center',
                 width: 495
               });

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        const relativePath = `uploads/prescriptions/${filename}`;
        console.log(`✅ Comprehensive PDF generated: ${relativePath}`);
        resolve(relativePath);
      });

      stream.on('error', (err) => {
        console.error('❌ PDF generation error:', err);
        reject(err);
      });

    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      reject(error);
    }
  });
};

export default generatePrescriptionPDF;

// ===================== END OF FILE =====================