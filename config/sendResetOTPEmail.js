const nodemailer = require('nodemailer');
const logger = require('./logger');

const sendResetOTPEmail = async (email, subject, otp) => {
    try {
        // Create a transporter
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: subject,
            html: `
            <div style="font-family: Arial, sans-serif; color: #333; background-color: #f4f4f4; padding: 20px; max-width: 600px; margin: 0 auto; border-radius: 10px;">
                <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #0056b3; text-align: center;">Password Reset Request</h2>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">Dear Customer,</p>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">
                        We have received a request to reset the password for your PSB Marketing account. To proceed, please use the following One-Time Password to complete the process:
                    </p>
                    <div style="text-align: center; margin: 20px 0;">
                        <p style="font-size: 24px; font-weight: bold; color: #0056b3;">${otp}</p>
                    </div>
                    <p style="font-size: 14px; color: #777;">This OTP is valid for the next 10 minutes.</p>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">
                        If you did not request a password reset, please ignore this email and ensure the security of your account. For any assistance, feel free to reach out to our support team.
                    </p>
                    <p style="font-size: 16px; color: #333;">Best regards,</p>
                    <p style="font-size: 16px; color: #333;"><strong>Arvind Singh</strong><br>Founder and Managing Director<br>PSB Marketing</p>
                    <hr style="border: 0; height: 1px; background-color: #ddd; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">
                        PSB Marketing - Revolutionizing Shopping in Independent India<br>
                        <a href="https://psbmarketing.com" style="color: #0056b3; text-decoration: none;">www.psbmarketing.com</a>
                    </p>
                </div>
            </div>
            `,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);

        logger.info(`Email sent successfully to ${email}. Message ID: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`Error sending email to ${email}: ${error.message}`);
        throw error;
    }
};

module.exports = sendResetOTPEmail;
