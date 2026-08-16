const crypto = require("crypto");
const nodemailer = require("nodemailer");
const envFile = require("./env.json");

/*
    derived from https://nodemailer.com/
*/
// Create a transporter using SMTP
let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: envFile.EMAIL_USER,
    pass: envFile.EMAIL_APP_PASSWORD,
  },
});

async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log("Email server connection successful");
    return true;
  } catch (error) {
    console.log("Email server connection failed:", error.message);
    return false;
  }
}

// verifyEmailConnection();

function generateVerificationCode() {
  // uses crypto library to generate a random 6-digit code
  //harder to guess than a simple code
  return crypto.randomInt(100000, 1000000).toString();
}

async function sendVerificationEmail(email, code) {
  try {
    const info = await transporter.sendMail({
      from: envFile.EMAIL_USER,
      to: email,
      subject: "Quantum Potatoes Verification",
      text: `Your verification code is: ${code}`,
    });

    console.log("Verification email sent:", info.messageId);

    return true;
  } catch (error) {
    console.log("Failed to send verification email:", error.message);
    return false;
  }
}
//just a main function to test the email sending
async function main() {
  const connected = await verifyEmailConnection();
  if (!connected) {
    console.log("Verified connection failed");
    return;
  }
  console.log("Verified connection successful");
  const code = generateVerificationCode();
  await sendVerificationEmail("sm4872@drexel.edu", code);
  console.log("Verification code:", code);
}

main();

module.exports = {
  verifyEmailConnection,
  generateVerificationCode,
  sendVerificationEmail,
};
