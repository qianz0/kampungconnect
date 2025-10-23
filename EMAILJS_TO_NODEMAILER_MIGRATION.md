# Migration from EmailJS to Nodemailer - Change Summary

## 🔄 Changes Made

### Issue
EmailJS was blocking API calls from the Node.js backend with error:
```
API calls are disabled for non-browser applications
```

EmailJS is designed for browser/frontend use only and doesn't support server-side Node.js applications.

### Solution
Migrated from **EmailJS** to **Nodemailer** - a robust Node.js email library designed for server-side applications.

---

## 📝 Files Modified

### 1. `backend/services/auth-service/package.json`
- ❌ Removed: `"@emailjs/nodejs": "^4.1.0"`
- ✅ Added: `"nodemailer": "^6.9.7"`

### 2. `backend/services/auth-service/src/otp-service.js`
**Changes:**
- Replaced EmailJS SDK with Nodemailer
- Changed configuration from EmailJS credentials to SMTP settings
- Added HTML email template generation (`generateEmailHTML()` method)
- Updated email sending logic with proper error handling
- Maintained fallback console logging for development

**Key Improvements:**
- Beautiful HTML email templates with gradient design
- Professional formatting with OTP display box
- Plain text fallback for email clients without HTML support
- Better error messages and logging

### 3. `docker-compose.yml`
**Removed EmailJS variables:**
```yaml
- EMAILJS_SERVICE_ID
- EMAILJS_PUBLIC_KEY
- EMAILJS_PRIVATE_KEY
- EMAILJS_TEMPLATE_SIGNUP
- EMAILJS_TEMPLATE_RESET
```

**Added SMTP variables:**
```yaml
- SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
- SMTP_PORT=${SMTP_PORT:-587}
- SMTP_SECURE=${SMTP_SECURE:-false}
- SMTP_USER=${SMTP_USER:-}
- SMTP_PASSWORD=${SMTP_PASSWORD:-}
- SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL:-}
- SMTP_FROM_NAME=${SMTP_FROM_NAME:-KampungConnect}
```

### 4. `.env.example`
Updated to reflect new SMTP configuration with helpful comments.

---

## 📚 New Documentation

### Created: `SMTP_EMAIL_SETUP_GUIDE.md`
Comprehensive guide covering:
- Gmail App Password setup (recommended)
- Multiple email provider configurations (Gmail, Outlook, Yahoo, SendGrid, AWS SES)
- Troubleshooting common issues
- Security best practices
- Production recommendations
- Testing instructions

---

## 🚀 How to Use

### Quick Start with Gmail

1. **Generate Gmail App Password:**
   - Enable 2FA: https://myaccount.google.com/security
   - Create App Password: https://myaccount.google.com/apppasswords
   - Copy the 16-character password

2. **Create/Update `.env` file:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=KampungConnect
   ```

3. **Rebuild and restart services:**
   ```bash
   docker-compose down
   docker-compose up --build
   ```

4. **Test registration** - You should now receive OTP emails!

---

## ✅ Benefits of This Change

1. **Server-Side Compatible**: Nodemailer is designed for Node.js backends
2. **No Browser Restrictions**: Works perfectly in Docker containers
3. **More Reliable**: Direct SMTP connection is more stable
4. **Better Templates**: Full control over HTML email design
5. **Multiple Provider Support**: Easy to switch between Gmail, SendGrid, AWS SES, etc.
6. **Professional**: Better suited for production applications
7. **Cost-Effective**: Most SMTP providers have generous free tiers
8. **Scalable**: Can handle high email volumes with proper SMTP service

---

## 🔍 Development Mode

If SMTP is not configured (missing credentials), the system still works:
- OTP codes are printed in console logs
- Registration/verification can be tested without email setup
- Perfect for local development

Example console output:
```
╔════════════════════════════════════════╗
║  OTP CODE FOR user@example.com         ║
║  Code: 123456                          ║
║  Type: signup                          ║
╚════════════════════════════════════════╝
```

---

## 🔒 Security Notes

- **Never commit `.env` file** - Contains sensitive credentials
- **Use App Passwords** - More secure than account passwords
- **Enable 2FA** - Required for Gmail App Passwords
- **Rotate credentials** - Change passwords regularly
- **Use professional services** - Consider SendGrid/AWS SES for production

---

## 📧 Email Features

The new system sends beautifully formatted emails with:
- Professional gradient header
- Clear OTP code display with large font
- Expiry time information
- Responsive design for mobile/desktop
- Branded footer
- Plain text fallback

---

## 🐛 Troubleshooting

If emails don't send:
1. Check console logs for detailed error messages
2. Verify SMTP credentials are correct
3. Ensure 2FA and App Password are set up (for Gmail)
4. Check firewall isn't blocking ports 587/465
5. Try different SMTP provider
6. Review `SMTP_EMAIL_SETUP_GUIDE.md` for detailed troubleshooting

---

## 📊 Next Steps

1. Set up SMTP credentials in `.env` file
2. Test with a real email address
3. For production: Consider using SendGrid or AWS SES for better deliverability
4. Customize email templates in `otp-service.js` if needed
5. Monitor email sending quotas and limits

---

## 🆘 Support

For detailed setup instructions, see:
- **SMTP_EMAIL_SETUP_GUIDE.md** - Complete setup guide
- **README.md** - General application documentation
- Console logs - Detailed error messages and debugging info

The migration is complete and the system is ready to send emails via SMTP! 🎉
