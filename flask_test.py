from flask import Flask, request

app = Flask(__name__)

@app.route('/')
def index():
    client_ip = request.remote_addr
    return f'Client IP Address: {client_ip}'

if __name__ == '__main__':
    app.run(debug=True)
