import dotenv from "dotenv";
import express from 'express';
import fs from 'fs';
import { Octokit } from "@octokit/rest";
import { Pool } from 'pg';

dotenv.config();

const app = express();

// PostgreSQLの接続情報
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.OSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432, // PostgreSQLのデフォルトポート
　ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

app.use((req, res, next) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

app.use(express.json());

/*const octokit = new Octokit({
    auth: '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',
});

const owner = 'yykk2409';
const repo = 'new-can';

const attendanceFilePath = 'attendance.json';
const countsFilePath = 'counts.json';

const quizFilePath = 'quiz.json';
const scheduleFilePath = 'schedule.json';*/
const classFilePath = 'templates/class.json';
// PostgreSQLからデータを読み込む関数
// PostgreSQLからデータを読み込む関数
const client = await pool.connect();
async function loadDataFromPostgreSQL(table, callback) {
    try {
        // idが1のデータを取得するためのSQLクエリ
        const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [1]);
        
        if (result.rows.length > 0) {
            // 取得したデータを文字列としてコールバック関数に渡す
            callback(result.rows[0].data); 
        } else {
            // データが存在しない場合は空のJSON文字列をコールバック関数に渡す
            callback("{}"); 
        }
    } catch (err) {
        console.error(`Error reading ${table} data from PostgreSQL:`, err);
    } finally {
        client.release();
    }
}




// PostgreSQLにデータを保存する関数
async function saveDataToPostgreSQL(table, data) {
    try {
        await client.query(`UPDATE ${table} SET data = $1 WHERE id = $2`, [JSON.stringify(data),1]);
    } catch (err) {
        console.error(`Error writing ${table} data to PostgreSQL:`, err);
    } finally {
        client.release();
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
let attendanceData = {};
let countsData = {};
loadclassData();
let quizData = {};
let scheduleData = {};

function loadAllData() {
    loadDataFromPostgreSQL('attendance_data', (data) => { attendanceData = data });
    loadDataFromPostgreSQL('counts_data', (data) => { countsData = data });
    loadDataFromPostgreSQL('quiz_data', (data) => { quizData = data });
    loadDataFromPostgreSQL('schedule_data', (data) => { scheduleData = data });
}

loadAllData();

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
app.get('/enter/:class', async (req, res) => {
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
    await saveDataToPostgreSQL('attendance_data', attendanceData);
    await saveDataToPostgreSQL('counts_data', countsData);

    res.json({ message: 'Entered( ' + classroom + ' )successfully' });
	 
});

// 退場処理
async function exitIfStayedTooLong() {
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
    await saveDataToPostgreSQL('attendance_data', attendanceData);
    await saveDataToPostgreSQL('counts_data', countsData);
}

// 一定間隔で退場処理を実行
setInterval(exitIfStayedTooLong, 1000); // 1分ごとにチェック
app.post('/form_send', async (req, res) => {
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
    await saveDataToPostgreSQL('attendance_data', attendanceData);

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

app.get('/schedule', async (req, res) => {
    res.sendFile(__dirname + '/schedule.html');
    console.log("sendschedule")
});
app.post('/api/delete_schedule',async (req,res) => {
    console.log(req.body)
    const { index, loc } = req.body;
    console.log(index)
    console.log(loc)
    scheduleData[loc].day.splice( index, 1 );
    scheduleData[loc].startTime.splice( index,1 );
    scheduleData[loc].endTime.splice( index, 1 );
    scheduleData[loc].event.splice( index, 1 );
    await saveDataToPostgreSQL('schedule_data', scheduleData);

    res.status(200).send('Schedule saved successfully');

})
app.post('/api/schedule', async (req, res) => {
    const scheduleDatas = req.body;
    scheduleData[scheduleDatas.loc].day.push(scheduleDatas.day);
    scheduleData[scheduleDatas.loc].startTime.push(scheduleDatas.startTime);
    scheduleData[scheduleDatas.loc].endTime.push(scheduleDatas.endTime)
    scheduleData[scheduleDatas.loc].event.push(scheduleDatas.event)
    
    // スケジュールデータをファイルに書き込む
    //writeFileToGitHub(scheduleFilePath, scheduleData)
    await saveDataToPostgreSQL('schedule_data', scheduleData);

    res.status(200).send('Schedule saved successfully');
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
