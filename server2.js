const express = require('express');
const fs = require('fs');

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // すべてのオリジンを許可
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // 許可するHTTPメソッド
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // 許可するヘッダー
  res.setHeader('Access-Control-Allow-Credentials', true); // 許可するクッキーなどの情報
  next();
});
app.use(express.json())
// IPアドレスごとの入場履歴を保存するJSONファイルのパス
const attendanceFilePath = 'attendance.json';
// 教室ごとの人数を保存するJSONファイルのパス
const countsFilePath = 'counts.json';

// IPアドレスごとの入場履歴と入場時間を保持するオブジェクト
let attendanceData = {};
// 教室ごとの人数を保持するオブジェクト
let countsData = {};

// JSONファイルからデータを読み込む関数
function loadAttendanceData() {
    try {
        const data = fs.readFileSync(attendanceFilePath);
        attendanceData = JSON.parse(data);
    } catch (err) {
        console.error('Error reading attendance file:', err);
    }
}

function loadCountsData() {
    try {
        const data = fs.readFileSync(countsFilePath);
        countsData = JSON.parse(data);
    } catch (err) {
        console.error('Error reading counts file:', err);
    }
}

// 初期読み込み
loadAttendanceData();
loadCountsData();

// 入場処理
app.get('/enter/:class', (req, res) => {
    const classroom = req.params.class;
    const ip = req.connection.remoteAddress;

    // IPアドレスごとの入場履歴と時間を更新
    const currentTime = new Date().getTime();
    if (!attendanceData[ip] ) {
        attendanceData[ip] = {age:'NaN',gender:'NaN', classrooms: [], timestamp: currentTime };
    }
	 if (attendanceData[ip].age == 'NaN'|| attendanceData[ip].gender == 'NaN'){
		  res.sendFile(__dirname + '/form.html');
		  console.log("sendfile")
		  return
	 }
	 attendanceData[ip].timestamp = currentTime
	 if (attendanceData[ip].classrooms[attendanceData[ip].classrooms.length - 1] == 'NaN') {
        attendanceData[ip].classrooms.pop();
		  attendanceData[ip].classrooms.push(classroom);
		 countsData[classroom] = (countsData[classroom] || 0) + 1;
		 console.log("各クラスの在中人数は"+JSON.stringify(countsData))
    }else if(attendanceData[ip].classrooms[attendanceData[ip].classrooms.length - 1] == classroom){
		  console.log("2回連続は無効です")
		  console.log("各クラスの在中人数は"+JSON.stringify(countsData))
	 }else{
		 attendanceData[ip].classrooms.push(classroom);
		 if (attendanceData[ip].classrooms.length > 1 ){
			 countsData[attendanceData[ip].classrooms[attendanceData[ip].classrooms.length - 2]] = (countsData[attendanceData[ip].classrooms[attendanceData[ip].classrooms.length - 2]] || 0) - 1;
		 }
		 countsData[classroom] = (countsData[classroom] || 0) + 1;
		 console.log("各クラスの在中人数は"+JSON.stringify(countsData))
	 }
    // 新しい教室を追加
    

    // JSONファイルに入場履歴を保存
    fs.writeFile(attendanceFilePath, JSON.stringify(attendanceData, null, 2), (err) => {
        if (err) {
            console.error('Error writing attendance file:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        // 教室ごとの人数を更新

		
        // JSONファイルに教室ごとの人数を保存
        fs.writeFile(countsFilePath, JSON.stringify(countsData, null, 2), (err) => {
            if (err) {
                console.error('Error writing counts file:', err);
                res.status(500).send('Internal Server Error');
                return;
            }
            res.json({ message: 'Entered classroom successfully' });
        });
    });
	 console.log(ip+"の入場履歴は"+attendanceData[ip].classrooms)
	 
});

// 退場処理
function exitIfStayedTooLong() {
    const currentTime = new Date().getTime();
    for (const ip in attendanceData) {
        const { classrooms, timestamp } = attendanceData[ip];
        if (classrooms && classrooms.length > 0 && classrooms[classrooms.length - 1] !== 'NaN' && (currentTime - timestamp) >= 15 * 60 * 1000) {
            const lastClassroom = classrooms[classrooms.length - 1];
            countsData[lastClassroom] = (countsData[lastClassroom] || 0) - 1;
            console.log(`User with IP ${ip} has exited from classroom ${lastClassroom}`);
			   console.log("各クラスの在中人数は"+JSON.stringify(countsData))
			   console.log(ip+"の入場履歴は"+attendanceData[ip].classrooms)
            attendanceData[ip].classrooms.push('NaN'); // NaNを追加
            attendanceData[ip].timestamp = currentTime; // 入場時間更新
        }else if(classrooms && classrooms.length > 0 && classrooms[classrooms.length - 1] == 'NaN' && (currentTime - timestamp) >= 15 * 60 * 1000){
			   attendanceData[ip].timestamp = currentTime; 
		  }
    }

    // JSONファイルに更新されたデータを保存
    fs.writeFile(attendanceFilePath, JSON.stringify(attendanceData, null, 2), err => {
        if (err) {
            console.error('Error writing attendance file:', err);
        }
    });
    fs.writeFile(countsFilePath, JSON.stringify(countsData, null, 2), err => {
        if (err) {
            console.error('Error writing counts file:', err);
        }
    });
}

// 一定間隔で退場処理を実行
setInterval(exitIfStayedTooLong, 1000); // 1分ごとにチェック
app.post('/form_send', (req, res) => {
    const ip = req.connection.remoteAddress;
    const { age, gender } = req.body;

    // フォームデータを入場データに保存
    attendanceData[ip].age = age;
    attendanceData[ip].gender = gender;
	console.log('Age:', age);
	console.log('Gender:', gender);

    // レスポンスを送信
    res.send('Form data received successfully');
});
// 教室ごとの人数を取得
app.get('/count/:class', (req, res) => {
    const classroom = req.params.class;
    const count = countsData[classroom] || 0;
    console.log("/count get")
    res.json({count});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
