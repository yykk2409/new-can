import json

FILE_NAME1 = "counts.json"
FILE_NAME2 = "attendance.json"
# データを定義
data = {}

# JSONファイルに書き込み
with open(FILE_NAME1, "w") as json_file:
    json.dump(data, json_file)
with open(FILE_NAME2, "w") as json_file:
    json.dump(data, json_file)
print("リセットしました。")