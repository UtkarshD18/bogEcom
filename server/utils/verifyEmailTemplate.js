const VerificationEmail=(username,otp)=>{
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
                color: #333;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                background: #fff;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .header {
            text-align: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 20px;
            }
            .header h1 {
                color: #4CAF50;
}
            .content {
                text-align: center;
            }
            .content p {
            font-size: 16px;
                line-height: 1.5;
            }
                .otp{
                    font-size:20px;
                    font-weight:bold;
                    color:#4CAF50;
                    margin:20px 0;
                }
            .footer {
                text-align: center;
                font-size: 14px;
                color: #777;
                margin-top: 20px;
}        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
            <h1>Hii ${username} Please Verify Your Email</h1>
            </div>
            <div class="content">
                <p>Thank you for registering with BuyOneGram! To complete your registration, please use the following One-Time Password (OTP) to verify your email address:</p>
                <div class="otp">${otp}</div>
                <p>This OTP is valid for the next 15 minutes. Please do not share this code with anyone.</p>
                <p>If you did not request this verification, please ignore this email.</p>
                <p>Best regards,<br/>The BuyOneGram Team</p>
            </div>
            <div class="footer">
                <p>&copy; 2024 BuyOneGram. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>`;


};
export default VerificationEmail;
