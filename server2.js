const express = require('express');
const fs = require('fs');
const { Octokit } = require("@octokit/rest");

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // すべてのオリジンを許可
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // 許可するHTTPメソッド
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // 許可するヘッダー
  res.setHeader('Access-Control-Allow-Credentials', true); // 許可するクッキーなどの情報
  next();
});
app.use(express.json())

// GitHubの認証情報
const octokit = new Octokit({
    auth: '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', // この行を適切なGitHubトークンに置き換えてください
});

const owner = 'yykk2409'; // リポジトリの所有者
const repo = 'new-can'; // リポジトリ名

// GitHubにファイルを書き込む関数
/*async function writeFileToGitHub(filePath, content) {
    let file;
    try {
        file = await octokit.repos.getContents({ owner, repo, path: filePath });
    } catch (e) {
        if (e.status !== 404) {
            throw e;
        }
        file = null;
    }

    await octokit.repos.createOrUpdateFile({
        owner,
        repo,
        path: filePath,
        message: 'Commit message',
        content: Buffer.from(content).toString('base64'),
        sha: file ? file.data.sha : null,
    });
}
*/

// IPアドレスごとの入場履歴を保存するJSONファイルのパス
const attendanceFilePath = 'attendance.json';
// 教室ごとの人数を保存するJSONファイルのパス
const countsFilePath = 'counts.json';
const classFilePath = 'class.json';
const quizFilePath = 'quiz.json';

const scheduleFilePath = 'schedule.json';


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
function loadclassData() {
    try {
        const data = fs.readFileSync(classFilePath);
        classData = JSON.parse(data);
    } catch (err) {
        console.error('Error reading counts file:', err);
    }
}
function loadQuizData() {
    try {
        const data = fs.readFileSync(quizFilePath);
        quizData = JSON.parse(data);
    } catch (err) {
        console.error('Error reading quiz file:', err);
    }
}
function loadscheduleData() {
    try {
        const data = fs.readFileSync(scheduleFilePath);
        scheduleData = JSON.parse(data);
    } catch (err) {
        console.error('Error reading schedule file:', err);
    }
}

// 初期読み込み
loadAttendanceData();
loadCountsData();
loadclassData();
loadQuizData();
loadscheduleData();



app.get("/enter-main",(req,res) =>{
	const remoteAddress = req.connection.remoteAddress;

	const splittedAddress = remoteAddress.split(':');
	//const clientIP = splittedAddress[splittedAddress.length - 1];

	const ipList = (req.headers['x-forwarded-for'] || '').split(',');
    const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;
	console.log(clientIP)
	const currentTime = new Date().getTime();
	if (!attendanceData[clientIP] ) {
		attendanceData[clientIP] = {age:'NaN',gender:'NaN',main:"n", classrooms: [], timestamp: currentTime };
	}
	if (attendanceData[clientIP].age == 'NaN'|| attendanceData[clientIP].gender == 'NaN'){
		res.sendFile(__dirname + '/form.html');
		console.log("sendfile")
		return
	}
	if (attendanceData[clientIP].main == "n"){
		countsData["main"] = (countsData["main"] || 0) + 1;
		attendanceData[clientIP].main = "y"
	}
	res.redirect("https://koryo-fes.studio.site");
});

// 入場処理
app.get('/enter/:class', (req, res) => {
	const classroom = classData[req.params.class];
	const remoteAddress = req.connection.remoteAddress;

	const splittedAddress = remoteAddress.split(':');
	const ipList = (req.headers['x-forwarded-for'] || '').split(',');
  const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;
	//const clientIP = splittedAddress[splittedAddress.length - 1];
	console.log(clientIP)

    // IPアドレスごとの入場履歴と時間を更新
    const currentTime = new Date().getTime();
    if (!attendanceData[clientIP] ) {
        attendanceData[clientIP] = {age:'NaN',gender:'NaN',main:"n", classrooms: [], timestamp: currentTime };
    }
	 if (attendanceData[clientIP].age == 'NaN'|| attendanceData[clientIP].gender == 'NaN'){
		  res.sendFile(__dirname + '/form.html');
		  console.log("sendfile")
		  return
	 }
	if (attendanceData[clientIP].main == "n"){
		countsData["main"] = (countsData["main"] || 0) + 1;
		attendanceData[clientIP].main = "y"
	}
	 attendanceData[clientIP].timestamp = currentTime
	 if (attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 1] == 'NaN') {
        attendanceData[clientIP].classrooms.pop();
		  attendanceData[clientIP].classrooms.push(classroom);
		 countsData[classroom] = (countsData[classroom] || 0) + 1;
		 console.log("各クラスの在中人数は"+JSON.stringify(countsData))
    }else if(attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 1] == classroom){
		  console.log("2回連続は無効です")
		  console.log("各クラスの在中人数は"+JSON.stringify(countsData))
	 }else{
		 attendanceData[clientIP].classrooms.push(classroom);
		 if (attendanceData[clientIP].classrooms.length > 1 ){
			 countsData[attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 2]] = (countsData[attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 2]] || 0) - 1;
		 }
		 countsData[classroom] = (countsData[classroom] || 0) + 1;
		 console.log("各クラスの在中人数は"+JSON.stringify(countsData))
	 }
    // 新しい教室を追加
    

    // JSONファイルに入場履歴を保存
    //writeFileToGitHub(attendanceFilePath, ttendanceData)
    fs.writeFile(attendanceFilePath, JSON.stringify(attendanceData, null, 2), (err) => {
        if (err) {
            console.error('Error writing attendance file:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        // 教室ごとの人数を更新

		
        // JSONファイルに教室ごとの人数を保存
        //writeFileToGitHub(countsFilePath, countsData)
        fs.writeFile(countsFilePath, JSON.stringify(countsData, null, 2), (err) => {
            if (err) {
                console.error('Error writing counts file:', err);
                res.status(500).send('Internal Server Error');
                return;
            }
            res.json({ message: 'Entered( ' + classroom + ' )successfully' });
        });
    });
	 console.log(clientIP+"の入場履歴は"+attendanceData[clientIP].classrooms)
	 
});

// 退場処理
function exitIfStayedTooLong() {
    const currentTime = new Date().getTime();
    for (const clientIP in attendanceData) {
        const { classrooms, timestamp } = attendanceData[clientIP];
        if (classrooms && classrooms.length > 0 && classrooms[classrooms.length - 1] !== 'NaN' && (currentTime - timestamp) >= 15 * 60 * 1000) {
            const lastClassroom = classrooms[classrooms.length - 1];
            countsData[lastClassroom] = (countsData[lastClassroom] || 0) - 1;
            console.log(`User with IP ${clientIP} has exited from classroom ${lastClassroom}`);
			   console.log("各クラスの在中人数は"+JSON.stringify(countsData))
			   console.log(clientIP+"の入場履歴は"+attendanceData[clientIP].classrooms)
            attendanceData[clientIP].classrooms.push('NaN'); // NaNを追加
            attendanceData[clientIP].timestamp = currentTime; // 入場時間更新
        }else if(classrooms && classrooms.length > 0 && classrooms[classrooms.length - 1] == 'NaN' && (currentTime - timestamp) >= 15 * 60 * 1000){
			   attendanceData[clientIP].timestamp = currentTime; 
		  }
    }

    // JSONファイルに更新されたデータを保存
    //writeFileToGitHub(attendanceFilePath, attendanceData)
    fs.writeFile(attendanceFilePath, JSON.stringify(attendanceData, null, 2), err => {
        if (err) {
            console.error('Error writing attendance file:', err);
        }
    });
    //writeFileToGitHub(countsFilePath, countsData)
    fs.writeFile(countsFilePath, JSON.stringify(countsData, null, 2), err => {
        if (err) {
            console.error('Error writing counts file:', err);
        }
    });
}

// 一定間隔で退場処理を実行
setInterval(exitIfStayedTooLong, 1000); // 1分ごとにチェック
app.post('/form_send', (req, res) => {
	const remoteAddress = req.connection.remoteAddress;

	const splittedAddress = remoteAddress.split(':');
	const ipList = (req.headers['x-forwarded-for'] || '').split(',');
    const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;
    const { age, gender } = req.body;

    // フォームデータを入場データに保存
    attendanceData[clientIP].age = age;
    attendanceData[clientIP].gender = gender;
	console.log('Age:', age);
	console.log('Gender:', gender);
    //writeFileToGitHub(attendanceFilePath, ttendanceData)
    fs.writeFile(attendanceFilePath, JSON.stringify(attendanceData, null, 2), err => {
        if (err) {
            console.error('Error writing attendance file:', err);
        }
    });
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
app.get('/attendancedata.json', (req, res) => {
    res.json({attendanceData});
});
app.get('/scheduledata.json', (req, res) => {
    res.json({scheduleData});
});
app.post('/quiz/:number', (req, res) => {
    const number = req.params.number;
    const answer = req.body.answer;

    // 正しい答えを取得（quizDataは適切に定義されていると仮定）
    const correctAnswer = quizData.answer[number];

    // 正解かどうかをチェック
    if (answer === correctAnswer) {
        console.log("正解");
        res.send("正解");
    } else {
        console.log("不正解");
        res.send("不正解");
    }
});

app.get('/schedule', (req, res) => {
    res.sendFile(__dirname + '/schedule.html');
    console.log("sendschedule")
});
app.post('/api/delete_schedule',(req,res) => {
    console.log(req.body)
    const { index, loc } = req.body;
    console.log(index)
    console.log(loc)
    scheduleData[loc].day.splice( index, 1 );
    scheduleData[loc].startTime.splice( index,1 );
    scheduleData[loc].endTime.splice( index, 1 );
    scheduleData[loc].event.splice( index, 1 );
    fs.writeFile(scheduleFilePath, JSON.stringify(scheduleData), (err) => {
        if (err) {
            console.error('Error writing schedule file:', err);
            res.status(500).send('Error writing schedule file');
            return;
        }

        console.log('Schedule saved successfully');
        res.status(200).send('Schedule saved successfully');
    });

})
app.post('/api/schedule', (req, res) => {
    const scheduleDatas = req.body;
    scheduleData[scheduleDatas.loc].day.push(scheduleDatas.day);
    scheduleData[scheduleDatas.loc].startTime.push(scheduleDatas.startTime);
    scheduleData[scheduleDatas.loc].endTime.push(scheduleDatas.endTime)
    scheduleData[scheduleDatas.loc].event.push(scheduleDatas.event)
    
    // スケジュールデータをファイルに書き込む
    //writeFileToGitHub(scheduleFilePath, scheduleData)
    fs.writeFile(scheduleFilePath, JSON.stringify(scheduleData), (err) => {
        if (err) {
            console.error('Error writing schedule file:', err);
            res.status(500).send('Error writing schedule file');
            return;
        }

        console.log('Schedule saved successfully');
        res.status(200).send('Schedule saved successfully');
    });
});

// Endpoint to get schedule
app.get('/api/schedule', (req, res) => {
    res.json(scheduleData);
});

app.get('/current-schedule-time/:loc',(req,res) =>{
    loc = req.params.loc
    
    scheduleDatas = scheduleData[loc]
    function getCurrentEvent(scheduleDatas) {
        // 現在の時刻を取得
        const now = new Date();
        const japanTime = new Date(now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
        const currentTime = japanTime.getHours() * 100 + japanTime.getMinutes(); // 時間を 24 時間形式に変換
        const today = japanTime.getDate()-12
        console.log(today);
        console.log(currentTime)
        // スケジュールデータから現在行われているイベントを検索
        for (let i = 0; i < scheduleDatas.day.length; i++) {
          const startTime = parseInt(scheduleDatas.startTime[i].replace(':', ''), 10);
          const endTime = parseInt(scheduleDatas.endTime[i].replace(':', ''), 10);
          console.log
          // 現在の時刻がイベントの開始時間と終了時間の間にある場合、そのイベントを返す
          if (scheduleDatas.day[i] == today.toString()){
            if (currentTime >= startTime && currentTime <= endTime) {
                return `${scheduleDatas.startTime[i]} - ${scheduleDatas.endTime[i]}`
            }
          }
        }
        // 現在行われているイベントがない場合は null を返す
        return null; 
      }
      
      // 現在行われているイベントを取得
      const currentEvent = getCurrentEvent(scheduleDatas);
      console.log(currentEvent)
      res.send(currentEvent)
})
app.get('/current-schedule-event/:loc',(req,res) =>{
    loc = req.params.loc
    
    scheduleDatas = scheduleData[loc]
    function getCurrentEvent(scheduleDatas) {
        // 現在の時刻を取得
        const now = new Date();
        const japanTime = new Date(now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
        const currentTime = japanTime.getHours() * 100 + japanTime.getMinutes(); // 時間を 24 時間形式に変換
        const today = japanTime.getDate()-12
        console.log(today);
        console.log(currentTime)
        // スケジュールデータから現在行われているイベントを検索
        for (let i = 0; i < scheduleDatas.day.length; i++) {
          const startTime = parseInt(scheduleDatas.startTime[i].replace(':', ''), 10);
          const endTime = parseInt(scheduleDatas.endTime[i].replace(':', ''), 10);
          const event = scheduleDatas.event[i];
          console.log
          // 現在の時刻がイベントの開始時間と終了時間の間にある場合、そのイベントを返す
          if (scheduleDatas.day[i] == today.toString()){
            if (currentTime >= startTime && currentTime <= endTime) {
                return event
            }
          }
        }
        // 現在行われているイベントがない場合は null を返す
        return null; 
      }
      
      // 現在行われているイベントを取得
      const currentEvent = getCurrentEvent(scheduleDatas);
      console.log(currentEvent)
      res.send(currentEvent)
})
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
