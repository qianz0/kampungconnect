# SMTP Email Setup Guide for KampungConnect

## Overview

KampungConnect uses **Nodemailer** to send OTP verification emails via SMTP. This guide will help you set up email services using Gmail or other SMTP providers.

---

## 🚀 Quick Start - Gmail Setup

### Option 1: Using Gmail App Password (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account:
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Visit: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Click "Generate"
   - Copy the 16-character password (remove spaces)

3. **Add to `.env` file**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=KampungConnect
   ```

### Option 2: Using "Less Secure Apps" (Not Recommended)

⚠️ **Warning**: This is less secure and Google may disable this option.

1. Enable "Less secure app access":
   - Go to https://myaccount.google.com/lesssecureapps
   - Turn ON "Allow less secure apps"

2. **Add to `.env` file**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-gmail-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=KampungConnect
   ```

---

## 📧 Other Email Providers

### Outlook/Office 365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
SMTP_FROM_NAME=KampungConnect
```

### Yahoo Mail

1. Generate App Password at: https://login.yahoo.com/account/security

```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@yahoo.com
SMTP_FROM_NAME=KampungConnect
```

### SendGrid (Professional)

1. Sign up at https://sendgrid.com
2. Create API key

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=verified-sender@yourdomain.com
SMTP_FROM_NAME=KampungConnect
```

### AWS SES (Amazon Simple Email Service)

1. Set up AWS SES and verify domain/email
2. Create SMTP credentials

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM_EMAIL=verified@yourdomain.com
SMTP_FROM_NAME=KampungConnect
```

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SMTP_HOST` | SMTP server hostname | smtp.gmail.com | No |
| `SMTP_PORT` | SMTP server port | 587 | No |
| `SMTP_SECURE` | Use SSL/TLS (true for port 465) | false | No |
| `SMTP_USER` | Email account username | - | **Yes** |
| `SMTP_PASSWORD` | Email account password or app password | - | **Yes** |
| `SMTP_FROM_EMAIL` | From email address | SMTP_USER | No |
| `SMTP_FROM_NAME` | From display name | KampungConnect | No |

### Port Configuration

- **Port 587**: TLS/STARTTLS (recommended) - `SMTP_SECURE=false`
- **Port 465**: SSL - `SMTP_SECURE=true`
- **Port 25**: Unencrypted (not recommended)

---

## 🧪 Testing Email Configuration

### 1. Create a `.env` file

Create a `.env` file in the root directory:

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=KampungConnect

# Other required variables
JWT_SECRET=your-jwt-secret-key
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kampungconnect
DB_USER=admin
DB_PASSWORD=password
```

### 2. Restart Docker Services

```bash
docker-compose down
docker-compose up --build
```

### 3. Test Registration

Try registering a new user. You should receive an OTP email.

---

## 🐛 Troubleshooting

### Issue: "Invalid login: 535 Authentication failed"

**Solution**: 
- Verify SMTP_USER and SMTP_PASSWORD are correct
- For Gmail, use App Password instead of account password
- Check if 2FA is enabled (required for Gmail App Passwords)

### Issue: "Connection timeout"

**Solution**:
- Check SMTP_HOST and SMTP_PORT
- Verify firewall isn't blocking outgoing connections on port 587/465
- Try different port (587 vs 465) with correct SMTP_SECURE setting

### Issue: "Self-signed certificate" error

**Solution**:
Add to `.env`:
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```
⚠️ Only use this for development, not production!

### Issue: Emails go to spam

**Solution**:
- Use authenticated SMTP service (SendGrid, AWS SES)
- Set up SPF, DKIM, and DMARC records for your domain
- Use verified sender email address

### Issue: "Daily sending limit exceeded"

**Solution**:
- **Gmail free**: 500 emails/day
- **Gmail Workspace**: 2,000 emails/day
- Consider using SendGrid (100 emails/day free) or AWS SES

---

## 📝 Development Mode

If SMTP is not configured, the system will still work in development mode. OTP codes will be printed in the console logs:

```
╔════════════════════════════════════════╗
║  OTP CODE FOR user@example.com         ║
║  Code: 123456                          ║
║  Type: signup                          ║
╚════════════════════════════════════════╝
```

You can use this code to verify emails during development without setting up SMTP.

---

## 🔒 Security Best Practices

1. **Never commit `.env` file** to version control
2. **Use App Passwords** instead of account passwords
3. **Enable 2FA** on email accounts
4. **Use environment-specific credentials** (dev/staging/prod)
5. **Rotate passwords regularly**
6. **Use professional email service** (SendGrid, AWS SES) for production
7. **Monitor email sending quotas** and rate limits

---

## 📧 Email Template

The OTP service sends beautifully formatted HTML emails with:
- Professional gradient header
- Clear OTP code display
- Expiry information
- Responsive design
- Plain text fallback

You can customize the templates in `backend/services/auth-service/src/otp-service.js` in the `generateEmailHTML()` method.

---

## 🚀 Production Recommendations

For production environments, consider:

1. **SendGrid** (https://sendgrid.com)
   - 100 emails/day free
   - Professional email delivery
   - Analytics and monitoring

2. **AWS SES** (https://aws.amazon.com/ses/)
   - $0.10 per 1,000 emails
   - High deliverability
   - Scales automatically

3. **Mailgun** (https://www.mailgun.com)
   - 5,000 emails/month free
   - Powerful API
   - Email validation

---

## 📚 Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords Setup](https://support.google.com/accounts/answer/185833)
- [SendGrid Getting Started](https://docs.sendgrid.com/for-developers/sending-email/getting-started-smtp)
- [AWS SES Setup Guide](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)

---

## 🆘 Need Help?

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a different email provider
4. Review the troubleshooting section above

The OTP service is designed to be resilient - even if email sending fails in development, you'll still see the OTP code in the console logs.
