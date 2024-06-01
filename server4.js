import dotenv from "dotenv";
import express from 'express';
import fs, { readFileSync } from 'fs';
import { Octokit } from "@octokit/rest";
import pg from 'pg';
const { Pool } = pg;
import path from 'path';

const app = express();
dotenv.config();
// PostgreSQLの接続情報
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL + "?sslmode=require",
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

const classFilePath = 'templates/class.json';
const client = await pool.connect();
async function loadDataFromPostgreSQL(table, callback) {
    try {
        const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [1]);
        if (result.rows.length > 0) {
            callback(result.rows[0].data);
        } else {
            callback("{}");
        }
    } catch (err) {
        console.error(`Error reading ${table} data from PostgreSQL:`, err);
        throw err; // エラーを投げる
    }
}

async function saveDataToPostgreSQL(table, data) {
    try {
        await client.query(`UPDATE ${table} SET data = $1 WHERE id = $2`, [JSON.stringify(data), 1]);
    } catch (err) {
        console.error(`Error writing ${table} data to PostgreSQL:`, err);
        throw err; // エラーを投げる
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

let attendanceData = { "status": "false" };
let countsData = {};
let quizData = {};
let scheduleData = {};
let classData = {}
loadclassData();
async function loadAllData() {
    try {
        loadclassData();
        await Promise.all([
            loadDataFromPostgreSQL('attendance_data', (data) => { attendanceData = data }),
            loadDataFromPostgreSQL('counts_data', (data) => { countsData = data }),
            //loadDataFromPostgreSQL('quiz_data', (data) => { quizData = data }),
            loadDataFromPostgreSQL('schedule_data', (data) => { scheduleData = data })
        ]);
    } catch (err) {
        console.error("Error loading data from PostgreSQL:", err);
        // 何らかのリカバリー処理や、エラーメッセージをクライアントに送信する処理を追加することができます。
    }
}


//loadAllData();

app.get("/enter-main/process", async (req, res) => {
    await loadAllData();

    const ipList = (req.headers['x-forwarded-for'] || '').split(',');
    //const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;
    const clientIP = req.query.id;
    console.log(clientIP)
    const currentTime = new Date().getTime();
    if (attendanceData["status"] == "True") {
        if (!attendanceData[clientIP]) {
            attendanceData[clientIP] = { age: 'NaN', gender: 'NaN', main: "n", classrooms: [], timestamp: currentTime };
        }
        if (attendanceData[clientIP].age == 'NaN' || attendanceData[clientIP].gender == 'NaN') {
            //res.sendFile(path.resolve(new URL('./form.html', import.meta.url).pathname));
            //res.sendFile(path.resolve(new URL('./new-htmls/form.html', import.meta.url).pathname));
            res.status(200).send("form");
            console.log("sent form");
            return;
        }
        if (attendanceData[clientIP].main == "n") {
            countsData["main"] = (countsData["main"] || 0) + 1;
            attendanceData[clientIP].main = "y";
        }
        //res.redirect("https://koryo-fes.com");
        res.status(200).send("ok");
      
        await saveDataToPostgreSQL('attendance_data', attendanceData);
        await saveDataToPostgreSQL('counts_data', countsData);
    } else {
        //res.sendFile(path.resolve(new URL('./loading.html', import.meta.url).pathname));
        res.status(200).send("db loading");
    }
});

app.get("/enter-main", (req, res) => {
    res.contentType('text/html');
    res.status(200).send(readFileSync("./new-htmls/enter-main.html", { encoding: "utf-8" }));
});

// 入場処理
app.get('/enter/:class/process', async (req, res) => {
    await loadAllData();

    const classroom = classData[req.params.class];
    const ipList = (req.headers['x-forwarded-for'] || '').split(',');
    //const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;
    const clientIP = req.query.id;
    console.log(clientIP);

    // IPアドレスごとの入場履歴と時間を更新
    const currentTime = new Date().getTime();
    if (attendanceData["status"] == "True") {
        if (!attendanceData[clientIP]) {
            attendanceData[clientIP] = { age: 'NaN', gender: 'NaN', main: "n", classrooms: [], timestamp: currentTime };
        }
        if (attendanceData[clientIP].age == 'NaN' || attendanceData[clientIP].gender == 'NaN') {
            //res.sendFile(path.resolve(new URL('./form.html', import.meta.url).pathname));
            //res.sendFile(path.resolve(new URL('./new-htmls/form.html', import.meta.url).pathname));
            res.status(200).send("form");
            console.log("sendfile");
            return;
        }
        if (attendanceData[clientIP].main == "n") {
            countsData["main"] = (countsData["main"] || 0) + 1;
            attendanceData[clientIP].main = "y";
        }
        attendanceData[clientIP].timestamp = currentTime
        if (attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 1] == 'NaN') {
            attendanceData[clientIP].classrooms.pop();
            attendanceData[clientIP].classrooms.push(classroom);
            countsData[classroom] = (countsData[classroom] || 0) + 1;
            console.log("各クラスの在中人数は" + JSON.stringify(countsData));
        } else if (attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 1] == classroom) {
            console.log("2回連続は無効です");
            console.log("各クラスの在中人数は" + JSON.stringify(countsData));
        } else {
            attendanceData[clientIP].classrooms.push(classroom);
            if (attendanceData[clientIP].classrooms.length > 1) {
                countsData[attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 2]] = (countsData[attendanceData[clientIP].classrooms[attendanceData[clientIP].classrooms.length - 2]] || 0) - 1;
            }
            countsData[classroom] = (countsData[classroom] || 0) + 1;
            console.log("各クラスの在中人数は" + JSON.stringify(countsData));
        }
        // JSONファイルに入場履歴を保存
        //writeFileToGitHub(attendanceFilePath, ttendanceData)
        await saveDataToPostgreSQL('attendance_data', attendanceData);
        await saveDataToPostgreSQL('counts_data', countsData);

        //res.redirect(`https://koryo-fes.com/enter/${req.params.class}`);
        res.status(200).send("ok");

    } else {
        //res.sendFile(path.resolve(new URL('./loading.html', import.meta.url).pathname));
        res.status(200).send("db loading");
    }
});
app.get("/enter/:class", (req, res) => {
    res.contentType('text/html');
    res.status(200).send(readFileSync("./new-htmls/enter-class.html", { encoding: "utf-8" }).replace("{classcode}", req.params.class));
    //exitIfStayedTooLong();
});

app.get("/cron", async (req, resp) => {
    await exitIfStayedTooLong();
    resp.status(200).send("ok");
});

// 退場処理
async function exitIfStayedTooLong() {
    await loadAllData();

    const currentTime = new Date().getTime();
    for (const clientIP in attendanceData) {
        if ((currentTime - attendanceData[clientIP].timestamp) >= 15 * 60 * 1000) {
            const length = attendanceData[clientIP].classrooms.length;
            const lastClass = attendanceData[clientIP].classrooms[length - 1]
            if (lastClass == "NaN") {
                continue;
            }
            countsData[lastClass] = (countsData[lastClass] || 0) - 1;
            if(countsData[lastClass] < 0){
                countsData[lastClass] = 0;
            }
            console.log(`use with id: ${clientIP} has exited from ${lastClass} exceeding the 15min timeout`);
            console.log(`各クラスの人数: ${JSON.stringify(countsData)}`);
            console.log(`${clientIP}の入場履歴は ${JSON.stringify(attendanceData[clientIP].classrooms)}`);
            attendanceData[clientIP].classrooms.push("NaN");
            attendanceData[clientIP].timestamp = currentTime;
        }
    }
    await saveDataToPostgreSQL("attendance_data", attendanceData);
    await saveDataToPostgreSQL("counts_data", countsData);


    //if (attendanceData["status"] == "True") {
    //    const currentTime = new Date().getTime();
    //    for (const clientIP in attendanceData) {
    //        const { classrooms, timestamp } = attendanceData[clientIP];
    //        if (classrooms && classrooms.length > 0 && classrooms[classrooms.length - 1] !== 'NaN' && (currentTime - timestamp) >= 15 * 60 * 1000) {
    //            const lastClassroom = classrooms[classrooms.length - 1];
    //            countsData[lastClassroom] = (countsData[lastClassroom] || 0) - 1;
    //            console.log(`User with IP ${clientIP} has exited from classroom ${lastClassroom}`);
    //            console.log("各クラスの在中人数は" + JSON.stringify(countsData))
    //            console.log(clientIP + "の入場履歴は" + attendanceData[clientIP].classrooms)
    //            attendanceData[clientIP].classrooms.push('NaN'); // NaNを追加
    //            attendanceData[clientIP].timestamp = currentTime; // 入場時間更新
    //            await saveDataToPostgreSQL('attendance_data', attendanceData);
    //            await saveDataToPostgreSQL('counts_data', countsData);
    //        }/*else if(classrooms && classrooms.length > 0 && classrooms[classrooms.length - 1] == 'NaN' && (currentTime - timestamp) >= 15 * 60 * 1000){
    //	    attendanceData[clientIP].timestamp = currentTime; 
    //        }*/
    //    }
    //    // JSONファイルに更新されたデータを保存
    //    //writeFileToGitHub(attendanceFilePath, attendanceData)
    //}
}
// 一定間隔で退場処理を実行
//moved to /enter/:class
//setInterval(exitIfStayedTooLong, 60000); // 1分ごとにチェック


app.get('/getLastvisited', async (req, res) => {
    res.contentType("text/html");
    res.status(200).send(readFileSync("./new-htmls/getLastVisited.html", { encoding: "utf-8" }));
});
app.get('/getLastvisited/process', async (req, res) => {
    await loadAllData();

    const ipList = (req.headers['x-forwarded-for'] || '').split(',');
    //const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;

    const clientIP = req.query.id;
    let classrooms = attendanceData[clientIP].classrooms
    let classroom = classrooms[classrooms.length - 1]
    let classId = Object.keys(classData).find((key) => classData[key] === classroom);
    res.status(200).json({
        classId: classId
    });
});

app.get("/form", (req, res) => {
    res.contentType("text/html");
    res.status(200).send(readFileSync("./new-htmls/form.html", { encoding: "utf-8" }));
})
app.post('/form_send', async (req, res) => {
    await loadAllData();

    const ipList = (req.headers['x-forwarded-for'] || '').split(',');
    //const clientIP = ipList.length > 0 ? ipList[0] : req.connection.remoteAddress;
    const clientIP = req.query.id;
    const { age, gender } = req.body;

    // フォームデータを入場データに保存
    if (!attendanceData[clientIP]) {
        attendanceData[clientIP] = {
            age: age,
            gender: gender,
            classrooms: [],
            main: "y",
            timestamp: new Date().getTime()
        };
    } else {
        attendanceData[clientIP].age = age;
        attendanceData[clientIP].gender = gender;
    }
    console.log('Age:', age);
    console.log('Gender:', gender);
    //writeFileToGitHub(attendanceFilePath, ttendanceData)
    await saveDataToPostgreSQL('attendance_data', attendanceData);

    res.send('Form data received successfully');
});
// 教室ごとの人数を取得
app.get('/count/:class', async (req, res) => {
    await loadAllData();

    const classroom = req.params.class;
    const count = countsData[classroom] || 0;
    console.log("/count get")
    res.json({ count });
});
app.get("/count-main", async (req, resp) => {
    await loadAllData();

    const keys = Object.keys(attendanceData);
    let count = keys.length - 1;
    resp.json({ count });
});
app.get('/attendancedata.json', async (req, res) => {
    await loadAllData();
    res.json({ attendanceData });
});
app.get('/countsdata.json', async (req, res) => {
    await loadAllData();
    res.json({ countsData });
});
app.get('/scheduledata.json', async (req, res) => {
    await loadAllData();
    res.json({ scheduleData });
});
app.get('/statusCheck', async (req, res) => {
    await loadAllData();
    res.send(attendanceData["status"]);
});

app.get('/schedule', async (req, res) => {
    await loadAllData();

    if (attendanceData["status"] == "True") {
        res.sendFile(path.resolve(new URL('./schedule.html', import.meta.url).pathname));
        console.log("sendschedule")
    } else {
        res.sendFile(path.resolve(new URL('./loading.html', import.meta.url).pathname))
    }
});
app.post('/api/delete_schedule', async (req, res) => {
    await loadAllData();

    console.log(req.body)
    const { index, loc } = req.body;
    console.log(index)
    console.log(loc)
    scheduleData[loc]["day"].splice(index, 1);
    if (scheduleData[loc]["other_loc"]) {
        scheduleData[loc]["other_loc"].splice(index, 1);
    }
    scheduleData[loc]["startTime"].splice(index, 1);
    scheduleData[loc]["endTime"].splice(index, 1);
    scheduleData[loc]["event"].splice(index, 1);
    await saveDataToPostgreSQL('schedule_data', scheduleData);

    res.status(200).send('Schedule saved successfully');

})
app.post('/api/schedule', async (req, res) => {
    await loadAllData();

    const scheduleDatas = req.body;
    if (scheduleDatas["loc"] == "other") {
        scheduleData[scheduleDatas["loc"]]["other_loc"].push(scheduleDatas["other_loc"]);
    }
    scheduleData[scheduleDatas["loc"]]["day"].push(scheduleDatas["day"]);
    scheduleData[scheduleDatas["loc"]]["startTime"].push(scheduleDatas["startTime"]);
    scheduleData[scheduleDatas["loc"]]["endTime"].push(scheduleDatas["endTime"]);
    scheduleData[scheduleDatas["loc"]]["event"].push(scheduleDatas["event"]);

    // スケジュールデータをファイルに書き込む
    //writeFileToGitHub(scheduleFilePath, scheduleData)
    await saveDataToPostgreSQL('schedule_data', scheduleData);

    res.status(200).send('Schedule saved successfully');
});

// Endpoint to get schedule
app.get('/api/schedule', (req, res) => {
    res.json(scheduleData);
});

app.get('/current-schedule-time/:loc', async (req, res) => {
    await loadAllData();

    const loc = req.params.loc;

    const scheduleDatas = scheduleData[loc];
    function getCurrentEvent(scheduleDatas) {
        // 現在の時刻を取得
        const now = new Date();
        const japanTime = new Date(now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
        const currentTime = japanTime.getHours() * 100 + japanTime.getMinutes(); // 時間を 24 時間形式に変換
        const today = -japanTime.getDate() % 2 + 2
        console.log(today);
        console.log(currentTime)
        // スケジュールデータから現在行われているイベントを検索
        for (let i = 0; i < scheduleDatas["day"].length; i++) {
            const startTime = parseInt(scheduleDatas["startTime"][i].replace(':', ''), 10);
            const endTime = parseInt(scheduleDatas["endTime"][i].replace(':', ''), 10);
            // 現在の時刻がイベントの開始時間と終了時間の間にある場合、そのイベントを返す
            if (scheduleDatas["day"][i] == today.toString()) {
                if (currentTime >= startTime && currentTime <= endTime) {
                    return `${scheduleDatas["startTime"][i]} - ${scheduleDatas["endTime"][i]}`
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
});
app.get('/deleteDatas', (req, res) => {
    res.sendFile(path.resolve(new URL('./deleteData.html', import.meta.url).pathname))
});
app.get('/delete-attendance-data', async (req, res) => {
    attendanceData = { "status": "True" }
    await saveDataToPostgreSQL('attendance_data', attendanceData);
    res.status(200).send('attendanceData deleted successfully');
});
app.get('/delete-counts-data', async (req, res) => {
    countsData = {}
    await saveDataToPostgreSQL('counts_data', countsData);
    res.status(200).send('countsData deleted successfully');
});
app.get('/current-schedule-event/:loc', async (req, res) => {
    await loadAllData();

    let loc = req.params.loc

    let scheduleDatas = scheduleData[loc]
    function getCurrentEvent(scheduleDatas) {
        // 現在の時刻を取得
        const now = new Date();
        const japanTime = new Date(now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
        const currentTime = japanTime.getHours() * 100 + japanTime.getMinutes(); // 時間を 24 時間形式に変換
        const today = -japanTime.getDate() % 2 + 2
        console.log(today);
        console.log(currentTime)
        // スケジュールデータから現在行われているイベントを検索
        for (let i = 0; i < scheduleDatas["day"].length; i++) {
            const startTime = parseInt(scheduleDatas["startTime"][i].replace(':', ''), 10);
            const endTime = parseInt(scheduleDatas["endTime"][i].replace(':', ''), 10);
            const event = scheduleDatas["event"][i];
            // 現在の時刻がイベントの開始時間と終了時間の間にある場合、そのイベントを返す
            if (scheduleDatas["day"][i] == today.toString()) {
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