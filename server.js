const express = require('express');
const cors = require('cors');
const Core = require('@alicloud/pop-core');
const nodemailer = require('nodemailer');
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 阿里云短信服务配置
const smsClient = new Core({
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    accessKeySecret: 'YOUR_ACCESS_KEY_SECRET',
    endpoint: 'https://dysmsapi.aliyuncs.com',
    apiVersion: '2017-05-25'
});

// 阿里云邮件服务配置
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.aliyun.com',
    port: 465,
    secure: true,
    auth: {
        user: 'YOUR_EMAIL',
        pass: 'YOUR_EMAIL_PASSWORD'
    }
});

// 存储验证码
const verificationCodes = new Map();

// 生成随机验证码
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送短信验证码
app.post('/api/send-sms', async (req, res) => {
    const { phone } = req.body;
    const code = generateCode();

    try {
        const params = {
            PhoneNumbers: phone,
            SignName: 'YOUR_SMS_SIGN_NAME',
            TemplateCode: 'YOUR_SMS_TEMPLATE_CODE',
            TemplateParam: JSON.stringify({ code })
        };

        const result = await smsClient.request('SendSms', params, { method: 'POST' });

        if (result.Code === 'OK') {
            // 存储验证码，5分钟有效
            verificationCodes.set(`sms_${phone}`, {
                code,
                expires: Date.now() + 5 * 60 * 1000
            });

            res.json({ success: true, message: '验证码已发送' });
        } else {
            res.status(500).json({ success: false, message: '发送失败' });
        }
    } catch (error) {
        console.error('短信发送错误:', error);
        res.status(500).json({ success: false, message: '发送失败' });
    }
});

// 发送邮箱验证码
app.post('/api/send-email', async (req, res) => {
    const { email } = req.body;
    const code = generateCode();

    try {
        const mailOptions = {
            from: 'YOUR_EMAIL',
            to: email,
            subject: '智慧课堂 - 邮箱验证码',
            html: `
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2B579A;">智慧课堂</h2>
                    <p>您的验证码是：<strong style="color: #2B579A; font-size: 24px;">${code}</strong></p>
                    <p>验证码有效期为5分钟，请尽快使用。</p>
                    <p>如果这不是您的操作，请忽略此邮件。</p>
                </div>
            `
        };

        await emailTransporter.sendMail(mailOptions);

        // 存储验证码，5分钟有效
        verificationCodes.set(`email_${email}`, {
            code,
            expires: Date.now() + 5 * 60 * 1000
        });

        res.json({ success: true, message: '验证码已发送' });
    } catch (error) {
        console.error('邮件发送错误:', error);
        res.status(500).json({ success: false, message: '发送失败' });
    }
});

// 验证短信验证码
app.post('/api/verify-sms', (req, res) => {
    const { phone, code } = req.body;
    const stored = verificationCodes.get(`sms_${phone}`);

    if (!stored) {
        return res.status(400).json({ success: false, message: '验证码不存在或已过期' });
    }

    if (Date.now() > stored.expires) {
        verificationCodes.delete(`sms_${phone}`);
        return res.status(400).json({ success: false, message: '验证码已过期' });
    }

    if (stored.code !== code) {
        return res.status(400).json({ success: false, message: '验证码错误' });
    }

    verificationCodes.delete(`sms_${phone}`);
    res.json({ success: true, message: '验证成功' });
});

// 验证邮箱验证码
app.post('/api/verify-email', (req, res) => {
    const { email, code } = req.body;
    const stored = verificationCodes.get(`email_${email}`);

    if (!stored) {
        return res.status(400).json({ success: false, message: '验证码不存在或已过期' });
    }

    if (Date.now() > stored.expires) {
        verificationCodes.delete(`email_${email}`);
        return res.status(400).json({ success: false, message: '验证码已过期' });
    }

    if (stored.code !== code) {
        return res.status(400).json({ success: false, message: '验证码错误' });
    }

    verificationCodes.delete(`email_${email}`);
    res.json({ success: true, message: '验证成功' });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 