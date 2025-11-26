// Enhanced version with detailed logging for APK debugging

export const verifyPayment = async (req, res) => {
  try {
    const payload = req.body;

    console.log('=================================');
    console.log('📥 RECEIVED PAYLOAD:', JSON.stringify(payload, null, 2));
    console.log('=================================');

    const required = [
      "razorpay_order_id",
      "razorpay_payment_id",
      "razorpay_signature",
      "doctor_id",
      "patient_id",
      "patient_name",
      "patient_email",
      "appointment_date",
      "appointment_slot_time",
      "appointment_fee",
      "start_time",
      "end_time",
    ];

    // Check for missing fields
    const missingFields = [];
    for (const field of required) {
      if (!payload[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      console.error('❌ MISSING FIELDS:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    console.log('✅ All required fields present');

    // ✅ Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== payload.razorpay_signature) {
      console.error('❌ SIGNATURE MISMATCH');
      console.error('Generated:', generated_signature);
      console.error('Received:', payload.razorpay_signature);
      
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    console.log('✅ Signature verified');

    // ✅ Convert multi slots to string
    const slotString = Array.isArray(payload.appointment_slot_time)
      ? payload.appointment_slot_time.join(", ")
      : String(payload.appointment_slot_time);

    console.log('📅 Slot String:', slotString);

    // ✅ Get clinic ID
    const [availRows] = await db.query(
      `SELECT clinic_id FROM doctor_availability 
       WHERE doctor_id = ? AND status = 1 LIMIT 1`,
      [payload.doctor_id]
    );

    const clinic_id = availRows?.[0]?.clinic_id || payload.clinic_id || null;
    console.log('🏥 Clinic ID:', clinic_id);

    // ✅ First or follow-up visit
    const [prev] = await db.query(
      `SELECT id FROM appointments 
       WHERE patient_id = ? AND doctor_id = ? LIMIT 1`,
      [payload.patient_id, payload.doctor_id]
    );

    const appointment_type = prev.length ? "follow_up" : "first_visit";
    console.log('📋 Appointment Type:', appointment_type);

    // ✅ New appointment id
    const [maxRow] = await db.query(
      `SELECT IFNULL(MAX(id),0) AS maxId FROM appointments`
    );

    const nextSeq = maxRow[0].maxId + 1;
    const appointment_id = `APPT-${String(nextSeq).padStart(5, "0")}`;
    console.log('🆔 Appointment ID:', appointment_id);

    const meeting_id = uuidv4();
    const token = uuidv4();

    // ✅ FIXED INSERT
    const insertQuery = `
      INSERT INTO appointments (
        appointment_id,
        patient_id,
        patient_name,
        patient_email,
        doctor_id,
        clinic_id,
        appointment_date,
        appointment_slot_time,
        start_time,
        end_time,
        appointment_fee,
        fee_type,
        consultation_type,
        appointment_type,
        appointment_status,
        payment_status,
        transaction_id,
        meeting_id,
        token,
        reason,
        symptoms,
        medications
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const insertValues = [
      appointment_id,                    // 1
      payload.patient_id,                // 2
      payload.patient_name,              // 3
      payload.patient_email,             // 4
      payload.doctor_id,                 // 5
      clinic_id,                         // 6
      payload.appointment_date,          // 7
      slotString,                        // 8
      payload.start_time,                // 9
      payload.end_time,                  // 10
      payload.appointment_fee,           // 11
      payload.fee_type || "",            // 12
      payload.consultation_type || "",   // 13
      appointment_type,                  // 14
      "pending",                         // 15
      "paid",                            // 16
      payload.razorpay_payment_id,       // 17
      meeting_id,                        // 18
      token,                             // 19
      payload.reason || "",              // 20
      payload.symptoms || "",            // 21
      payload.medications || "",         // 22
    ];

    console.log('💾 Insert Values Count:', insertValues.length);
    console.log('💾 Insert Values:', JSON.stringify(insertValues, null, 2));

    try {
      await db.query(insertQuery, insertValues);
      console.log('✅ Database insert successful');
    } catch (dbError) {
      console.error('❌ DATABASE INSERT ERROR:', dbError);
      throw dbError;
    }

    // ✅ GET DOCTOR INFO
    const [doc] = await db.query(
      `SELECT name, email, phone_number FROM users WHERE id = ?`,
      [payload.doctor_id]
    );

    const doctorName = doc?.[0]?.name || "Doctor";
    const doctorEmail = doc?.[0]?.email;
    const doctorPhone = doc?.[0]?.phone_number;

    console.log('👨‍⚕️ Doctor Info:', { doctorName, doctorEmail, doctorPhone });

    // ✅ SEND EMAIL TO DOCTOR (with error handling)
    if (doctorEmail) {
      try {
        const doctorHtml = buildDoctorEmailHtml({
          doctorName,
          patientName: payload.patient_name,
          patientEmail: payload.patient_email,
          patientPhone: payload.patient_phone || "N/A",
          clinicName: "Clinic",
          date: payload.appointment_date,
          time: slotString,
          type: payload.consultation_type,
          appointment_id,
          reason: payload.reason,
        });

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: doctorEmail,
          subject: `New Appointment - ${appointment_id}`,
          html: doctorHtml,
        });
        console.log('✅ Doctor email sent');
      } catch (emailError) {
        console.error('⚠️ Doctor email failed (non-critical):', emailError.message);
      }
    }

    // ✅ WhatsApp to doctor
    if (doctorPhone) {
      try {
        await sendWhatsAppNotification(doctorPhone, "appointment_doctor", {
          doctor_name: doctorName,
          patientName: payload.patient_name,
          patientEmail: payload.patient_email,
          patientPhone: payload.patient_phone || "N/A",
          appointment_date: formatDateForEmail(payload.appointment_date),
          appointment_slot_time: slotString,
          consultation_type: payload.consultation_type,
          appointment_id,
          reason: payload.reason,
        });
      } catch (whatsappError) {
        console.error('⚠️ Doctor WhatsApp failed (non-critical):', whatsappError.message);
      }
    }

    // ✅ SEND EMAIL TO PATIENT
    try {
      const patientHtml = buildPatientEmailHtml({
        patientName: payload.patient_name,
        doctorName,
        specialization: "",
        clinicName: "Clinic",
        date: payload.appointment_date,
        time: slotString,
        type: payload.consultation_type,
        fee: payload.appointment_fee,
        appointment_id,
        transaction_id: payload.razorpay_payment_id,
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: payload.patient_email,
        subject: `Appointment Confirmed - ${appointment_id}`,
        html: patientHtml,
      });
      console.log('✅ Patient email sent');
    } catch (emailError) {
      console.error('⚠️ Patient email failed (non-critical):', emailError.message);
    }

    // ✅ WhatsApp to patient
    if (payload.patient_phone) {
      try {
        await sendWhatsAppNotification(payload.patient_phone, "appointment_patient", {
          patientName: payload.patient_name,
          doctor_name: doctorName,
          appointment_id,
          appointment_date: formatDateForEmail(payload.appointment_date),
          appointment_slot_time: slotString,
          consultation_type: payload.consultation_type,
          appointment_fee: payload.appointment_fee,
          transaction_id: payload.razorpay_payment_id,
        });
      } catch (whatsappError) {
        console.error('⚠️ Patient WhatsApp failed (non-critical):', whatsappError.message);
      }
    }

    console.log('✅ Payment verification complete - SUCCESS');

    return res.json({
      success: true,
      data: {
        appointment_id,
        appointment_date: payload.appointment_date,
        appointment_slot_time: slotString,
        appointment_fee: payload.appointment_fee,
        patient_name: payload.patient_name,
        doctor_id: payload.doctor_id,
        doctor_name: doctorName,
        consultation_type: payload.consultation_type,
        transaction_id: payload.razorpay_payment_id,
      },
    });

  } catch (err) {
    console.error('❌❌❌ VERIFY PAYMENT ERROR ❌❌❌');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Error Stack:', err.stack);
    console.error('Error Code:', err.code);
    console.error('SQL:', err.sql);
    
    return res.status(400).json({
      success: false,
      message: "Failed to verify/save appointment",
      error: err.message,
      errorCode: err.code,
      errorDetails: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};