const nodemailer = require("nodemailer");

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error("Thiếu biến môi trường: EMAIL_USER và EMAIL_APP_PASSWORD");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  return transporter;
};

const sendOtpMail = async ({ to, otp }) => {
  const mailTransporter = getTransporter();
  const year = new Date().getFullYear();

  await mailTransporter.sendMail({
    from: `"ChatApp" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject: "Mã xác thực OTP – Đặt lại mật khẩu",
    html: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mã xác thực OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#6366f1;border-radius:12px;padding:10px 14px;display:inline-block;">
                    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">💬 ChatApp</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

              <!-- Header strip -->
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:32px 40px 28px;text-align:center;">
                  <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:56px;">🔐</div>
                  <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Xác thực tài khoản</h1>
                  <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Yêu cầu đặt lại mật khẩu</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 40px;">
                  <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">Xin chào,</p>
                  <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                    Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này.
                    Sử dụng mã OTP bên dưới để tiếp tục:
                  </p>

                  <!-- OTP box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                    <tr>
                      <td align="center" style="background:#f5f3ff;border:2px dashed #a5b4fc;border-radius:12px;padding:24px 16px;">
                        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6366f1;letter-spacing:1.5px;text-transform:uppercase;">Mã xác thực</p>
                        <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#1e1b4b;font-family:'Courier New',monospace;">${otp}</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Timer note -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                    <tr>
                      <td style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;">
                        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
                          ⏱ Mã có hiệu lực trong <strong>10 phút</strong> kể từ khi nhận được email này.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Security note -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#f9fafb;border-radius:10px;padding:16px 20px;">
                        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#111827;">🔒 Lưu ý bảo mật</p>
                        <ul style="margin:0;padding-left:16px;font-size:13px;color:#6b7280;line-height:1.8;">
                          <li>Không chia sẻ mã này với bất kỳ ai.</li>
                          <li>ChatApp sẽ không bao giờ chủ động hỏi mã OTP của bạn.</li>
                          <li>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding:0 40px;">
                  <hr style="border:none;border-top:1px solid #f3f4f6;margin:0;" />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                    Email này được gửi tự động từ hệ thống ChatApp.
                  </p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    © ${year} ChatApp. Tất cả quyền được bảo lưu.
                  </p>
                </td>
              </tr>

            </td>
          </tr>

          <!-- Bottom spacing -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Bạn nhận được email này vì địa chỉ email của bạn được sử dụng để yêu cầu đặt lại mật khẩu.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

module.exports = { sendOtpMail };
