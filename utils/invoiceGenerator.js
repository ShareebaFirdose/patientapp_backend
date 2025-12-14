// utils/invoiceGenerator.js
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generates a professional invoice PDF for appointment bookings
 * @param {Object} invoiceData - Invoice details
 * @returns {Promise<string>} - Path to generated PDF
 */
export const generateInvoicePDF = async (invoiceData) => {
  const {
    appointment_id,
    invoice_number,
    invoice_date,
    patient_name,
    patient_email,
    patient_phone,
    doctor_name,
    specialization,
    clinic_name,
    clinic_address,
    appointment_date,
    appointment_slot_time,
    consultation_type,
    appointment_fee,
    tax_amount = 0,
    total_amount,
    transaction_id,
    payment_method = "Razorpay",
  } = invoiceData;

  return new Promise((resolve, reject) => {
    try {
      // Create invoices directory if it doesn't exist
      const invoicesDir = path.join(process.cwd(), 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const filename = `invoice_${invoice_number}.pdf`;
      const filepath = path.join(invoicesDir, filename);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      // Header with brand color
      doc.fillColor('#3B82F6')
         .fontSize(28)
         .text('PRED CARE', 50, 50);

      // Invoice title
      doc.fillColor('#0F172A')
         .fontSize(20)
         .text('INVOICE', 400, 50, { align: 'right' });

      doc.fontSize(9)
         .fillColor('#64748B')
         .text(`Invoice #: ${invoice_number}`, 400, 75, { align: 'right' })
         .text(`Date: ${formatDate(invoice_date)}`, 400, 88, { align: 'right' });

      // Line separator
      doc.moveTo(50, 110)
         .lineTo(550, 110)
         .strokeColor('#E2E8F0')
         .stroke();

      // Bill To Section
      doc.fontSize(12)
         .fillColor('#0F172A')
         .text('BILL TO:', 50, 130);

      doc.fontSize(10)
         .fillColor('#64748B')
         .text(patient_name, 50, 150)
         .text(patient_email, 50, 165)
         .text(patient_phone || '', 50, 180);

      // Appointment Details
      doc.fontSize(12)
         .fillColor('#0F172A')
         .text('APPOINTMENT DETAILS:', 320, 130);

      doc.fontSize(10)
         .fillColor('#64748B')
         .text(`Doctor: Dr. ${doctor_name}`, 320, 150);
      
      if (specialization) {
        doc.text(`Specialization: ${specialization}`, 320, 165);
      }
      
      doc.text(`Date: ${formatDate(appointment_date)}`, 320, 180)
         .text(`Time: ${appointment_slot_time}`, 320, 195)
         .text(`Type: ${consultation_type}`, 320, 210);

      // Table Header
      const tableTop = 250;
      doc.fontSize(10)
         .fillColor('#FFFFFF');

      // Table header background
      doc.rect(50, tableTop, 500, 25)
         .fill('#3B82F6');

      // Table headers
      doc.fillColor('#FFFFFF')
         .text('Description', 60, tableTop + 8)
         .text('Appointment ID', 250, tableTop + 8)
         .text('Amount', 450, tableTop + 8);

      // Table content
      const itemY = tableTop + 35;
      doc.fillColor('#0F172A')
         .text(`${consultation_type} Consultation`, 60, itemY)
         .text(appointment_id, 250, itemY)
         .text(`Rs. ${appointment_fee}`, 450, itemY);

      // Line under item
      doc.moveTo(50, itemY + 25)
         .lineTo(550, itemY + 25)
         .strokeColor('#E2E8F0')
         .stroke();

      // Subtotal, Tax, Total
      const summaryY = itemY + 50;
      doc.fontSize(10)
         .fillColor('#64748B')
         .text('Subtotal:', 380, summaryY)
         .text(`Rs. ${appointment_fee}`, 450, summaryY);

      if (tax_amount > 0) {
        doc.text('Tax:', 380, summaryY + 20)
           .text(`Rs. ${tax_amount}`, 450, summaryY + 20);
      }

      // Total amount background
      doc.rect(50, summaryY + 40, 500, 35)
         .fill('#F1F5F9');

      doc.fontSize(13)
         .fillColor('#0F172A')
         .text('TOTAL AMOUNT:', 60, summaryY + 52)
         .fontSize(18)
         .fillColor('#3B82F6')
         .text(`Rs. ${total_amount || appointment_fee}`, 380, summaryY + 50, { align: 'right', width: 160 });

      // Payment Information
      const paymentY = summaryY + 100;
      doc.fontSize(12)
         .fillColor('#0F172A')
         .text('PAYMENT INFORMATION:', 50, paymentY);

      doc.fontSize(10)
         .fillColor('#64748B')
         .text(`Transaction ID: ${transaction_id}`, 50, paymentY + 20)
         .text(`Payment Method: ${payment_method}`, 50, paymentY + 35)
         .text('Payment Status: PAID', 50, paymentY + 50)
         .fillColor('#10B981')
         .text('✓', 155, paymentY + 50);

      // Footer
      doc.fontSize(9)
         .fillColor('#64748B')
         .text('Thank you for choosing PRED CARE!', 50, 720, {
           align: 'center',
           width: 500
         })
         .text('For any queries, contact us at support@predcare.com', 50, 735, {
           align: 'center',
           width: 500
         });

      // Line above footer
      doc.moveTo(50, 710)
         .lineTo(550, 710)
         .strokeColor('#E2E8F0')
         .stroke();

      doc.end();

      stream.on('finish', () => {
        console.log(`✅ Invoice generated: ${filename}`);
        resolve(filepath);
      });

      stream.on('error', (err) => {
        console.error('❌ PDF generation error:', err);
        reject(err);
      });

    } catch (err) {
      console.error('❌ Invoice generation failed:', err);
      reject(err);
    }
  });
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Generate invoice number
 */
export const generateInvoiceNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};