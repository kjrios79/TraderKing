<?php
// login.php
$v = time();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - TraderKing Pro Bot</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            background: #0b0e11;
            color: #eaecef;
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .login-container {
            background: #161a1e;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            width: 100%;
            max-width: 400px;
            border: 1px solid #2b2f36;
        }
        .logo {
            text-align: center;
            font-size: 1.5rem;
            font-weight: 700;
            color: #f0b90b;
            margin-bottom: 30px;
        }
        label { display: block; margin-bottom: 8px; color: #848e9c; font-size: 0.9rem; }
        input {
            width: 100%;
            background: #2b2f36;
            border: 1px solid #2b2f36;
            padding: 12px;
            border-radius: 4px;
            color: white;
            margin-bottom: 20px;
            box-sizing: border-box; /* Fix input overflow */
        }
        input:focus { outline: none; border-color: #f0b90b; }
        
        button {
            width: 100%;
            padding: 12px;
            background: #f0b90b;
            color: #1e2329;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 15px;
        }
        button:hover { background: #dda60a; }

        .toggle-btn {
            background: none;
            color: #848e9c;
            font-weight: normal;
            font-size: 0.85rem;
            text-align: center;
            width: 100%;
            cursor: pointer;
            border:none;
            margin:0;
            padding:0;
        }
        .toggle-btn:hover { color: #f0b90b; text-decoration: underline; background:none;}

        #message {
            text-align: center;
            margin-bottom: 15px;
            font-size: 0.9rem;
            min-height: 20px;
        }
        .error { color: #f6465d; }
        .success { color: #2ebd85; }
    </style>
</head>
<body>

<div class="login-container">
    <div class="logo">TRADERKING <span style="font-size: 0.8em; opacity: 0.7;">PRO</span></div>
    
    <div id="message"></div>

    <form id="auth-form">
        <label>Username</label>
        <input type="text" id="username" required>
        
        <label>Password</label>
        <input type="password" id="password" required>
        
        <button type="submit" id="submit-btn" data-action="login">Login</button>
    </form>
    
    <button class="toggle-btn" id="toggle-form">Create an Account</button>
</div>

<script>
    const form = document.getElementById('auth-form');
    const msg = document.getElementById('message');
    const toggleBtn = document.getElementById('toggle-form');
    const submitBtn = document.getElementById('submit-btn');

    toggleBtn.addEventListener('click', () => {
        const isLogin = submitBtn.dataset.action === 'login';
        if (isLogin) {
            submitBtn.dataset.action = 'register';
            submitBtn.textContent = 'Register';
            toggleBtn.textContent = 'Back to Login';
        } else {
            submitBtn.dataset.action = 'login';
            submitBtn.textContent = 'Login';
            toggleBtn.textContent = 'Create an Account';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const action = submitBtn.dataset.action;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        msg.textContent = 'Processing...';
        msg.className = '';

        try {
            const formData = new FormData();
            formData.append('action', action);
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch('/api/auth.php', { method: 'POST', body: formData });
            
            // Safe JSON parse in case of PHP errors
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error("Server Error:", text);
                throw new Error("Server Error");
            }

            if (data.success) {
                if (action === 'register') {
                    msg.textContent = 'Registration successful! Please login.';
                    msg.className = 'success';
                    toggleBtn.click(); // Switch back to login
                } else {
                    window.location.href = '/index.php';
                }
            } else {
                msg.textContent = data.message;
                msg.className = 'error';
            }
        } catch (err) {
            msg.textContent = 'Connection error. Check console.';
            msg.className = 'error';
        }
    });
</script>

</body>
</html>
