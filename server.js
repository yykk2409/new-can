// Expressを使用した例
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const { readFileSync, writeFileSync } = require("fs");

// サンプルのユーザーデータベース
const users = [
  { username: 'Koryo2024', password: 'Kinoetatu' },
];
const nodemailer = require('nodemailer');

// 送信元のメールアカウント情報
const transporter = nodemailer.createTransport({
  service: 'Gmail', // または自分のSMTPサーバーの設定に合わせて変更
  auth: {
    user: 'honbu.koryo.fes@gmail.com', // 送信元のメールアドレス
    pass: 'Koryo2024' // 送信元のメールアカウントのパスワードまたはアプリパスワード
  }
});

// 送信先のメールアドレス
const toEmail = 'maetaka-2022066@edu-g.gsn.ed.jp'; // 送信先のメールアドレスを指定

// メールの内容
const mailOptions = {
  from: 'your_email@gmail.com', // 送信元のメールアドレス
  to: toEmail, // 送信先のメールアドレス
  subject: '蛟龍祭謎解きイベント', // メールの件名
  text: '正解しました。', // メールの本文
};

app.use(bodyParser.json());
app.get('/', (req, resp) => {
  resp.status(200).send(readFileSync("./test.html", { encoding: "utf-8" }));
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // ユーザーの認証
  const user = users.find(user => user.username === username && user.password === password);
  if (user) {
    // ログイン成功時の処理（トークンの発行など）
    const token = generateToken(); // トークン生成の関数
    res.json({ token });
  } else {
    res.status(401).json({ error: '認証失敗' });
  }
});
app.post('/signup', (req, res) => {
  // ユーザーの認証

  const { username, password } = req.body;
  // ユーザーの認証
  const user = users.find(user => user.username === username && user.password === password);
  if (user) {
    // ログイン成功時の処理（トークンの発行など）// トークン生成の関数
    writeFileSync('./userdata.json', JSON.stringify(data, null, '    '));
    res.status(200).send
  } else {
    res.status(401).json({ error: '認証失敗' });
  }
});
app.post("/answer", (req, res) => {
  txt = req.body.text
  console.log(txt)
  if (txt === '蛟龍祭') {
    res.status(200).send("<h1 style=color:red;font-size:100px;>正解です。</h1><br><p style=color:white;>受付カウンターにて景品を受け取ってください。</p>");
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error);
      }
    });
  } else {
    res.status(200).send("<h1 style=color:blue;font-size:100px;>不正解です。</h1><br><p style=color:white;>ヒントを集めましょう</p>");
  }
})
function generateToken() {
  const tokenLength = 20; // トークンの長さ
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // 使用する文字列

  let token = '';
  for (let i = 0; i < tokenLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters[randomIndex];
  }

  return token;
}

// サーバーを起動
app.listen(3000, () => {
  console.log('サーバーがポート3000で起動しました');
});
