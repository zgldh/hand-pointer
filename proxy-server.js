const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');
const fs = require('fs');
const app = express();

// 读取mkcert生成的证书和私钥
const options = {
    key: fs.readFileSync('0.0.0.0-key.pem'),
    cert: fs.readFileSync('0.0.0.0.pem')
};

// 创建一个HTTPS服务器
const server = https.createServer(options, app);

// 设置代理，将所有请求转发到parcel开发服务器
app.use((req, res, next) => {
    req.headers['x-forwarded-proto'] = 'https';
    next();
});

app.use('/', createProxyMiddleware({
    target: 'http://localhost:1234', // parcel开发服务器地址
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
        // 确保请求头中的host是localhost，而不是127.0.0.1或其他
        proxyReq.setHeader('host', 'localhost:1234');
    }
}));

// 启动代理服务器
server.listen(8443, '0.0.0.0', () => {
    console.log('Proxy server running on https://localhost:8443');
});