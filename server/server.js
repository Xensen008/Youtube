const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const http = require('http');
const { ffmpeg, tempDir } = require('./utils/ffmpeg.utils');

// Import routes
const infoRoutes = require('./routes/info.routes');
const downloadRoutes = require('./routes/download.routes');

const app = express();

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Share socket.io with controllers
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// API Routes
app.use('/api/info', infoRoutes);
app.use('/api/download', downloadRoutes);

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/dist/index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    console.log('Shutting down gracefully...');
    
    server.close(() => {
        console.log('Server closed.');
        
        // Clean all temp files on shutdown
        try {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                } catch (err) {
                    console.error(`Error deleting temp file ${file}:`, err);
                }
            });
            console.log('All temp files cleaned up.');
        } catch (err) {
            console.error('Error cleaning up temp files:', err);
        }
        
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds if the server hasn't closed
    setTimeout(() => {
        console.error('Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
}