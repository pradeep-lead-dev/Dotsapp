const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Create a new client instance with local session persistence
const client = new Client({
    authStrategy: new LocalAuth()  // This stores session data locally so you don't need to scan the QR code again.
});

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

let uniqueFileName;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads');
    },
    filename: function (req, file, cb) {
        const suffix = "";
        uniqueFileName = suffix + file.originalname;
        cb(null, uniqueFileName);
    },
});

const upload = multer({ storage: storage });

// Generate QR code for logging in
client.on('qr', (qr) => {
    console.log('QR Code Received', qr);
    qrcode.generate(qr, { small: true });  // Display the QR code in the terminal
});

// When the client is authenticated
client.on('ready', () => {
    console.log('Client is ready!');
});

// POST route to send a message
app.post('/send-message', (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ status: 'error', message: 'Missing number or message' });
    }

    // Send a message through WhatsApp Web
    client.sendMessage(`${number}@c.us`, message)
        .then(response => {
            res.status(200).json({ status: 'success', message: 'Message sent successfully!', response });
            console.log("message sent successfully to",number);

        })
        .catch(err => {
            res.status(500).json({ status: 'error', message: 'Failed to send message', error: err });
        });
});



app.post('/send-message-multiple', (req, res) => {
    const { numbers, message } = req.body;

    if (!numbers || !message) {
        return res.status(400).json({ status: 'error', message: 'Missing number or message' });
    }

    // Remove any invalid characters and ensure international format
    const formattedNumbers = numbers.map(number => {
        return (number+"").replace(/\D/g, ''); // Remove all non-digit characters
    });

    const messagePromises = formattedNumbers.map((number) => {
        // Ensure correct format (international number without spaces or special characters)
        const whatsappNumber = `${number}@c.us`; // Append @c.us to the cleaned number
        return client.sendMessage(whatsappNumber, message)
            .then(response => {
                console.log(`Message sent successfully to ${number}`);
                return { number, status: 'success', response };
            })
            .catch(err => {
                console.error(`Failed to send message to ${number}`, err);
                return { number, status: 'error', error: err };
            });
    });

    // Wait for all promises to resolve before sending the final response
    Promise.all(messagePromises)
        .then(results => {
            res.status(200).json({
                status: 'success',
                message: 'Messages processed',
                results
            });
        })
        .catch(error => {
            res.status(500).json({ status: 'error', message: 'Failed to process messages', error });
        });
});



// POST route to send a file
app.post('/send-file', upload.single('file'), (req, res) => {
    const { number } = req.body;
    const file = req.file;

    if (!number || !file) {
        return res.status(400).json({ status: 'error', message: 'Missing number or file' });
    }

    // Load the file as a MessageMedia object
    const filePath = path.join(__dirname, './uploads', uniqueFileName);
    const media = MessageMedia.fromFilePath(filePath);

    // Send the file through WhatsApp
    client.sendMessage(`${number}@c.us`, media)
        .then(response => {
            res.status(200).json({ status: 'success', message: 'File sent successfully!', response });
        })
        .catch(err => {
            res.status(500).json({ status: 'error', message: 'Failed to send file', error: err });
        });

        try{
            fs.unlinkSync(`./uploads/${uniqueFileName}`);
            console.log(uniqueFileName , 'temp deleted')
    
        }catch(e){
            console.log("no such dir or already ")
        }
});





app.post('/send-file-multiple', upload.single('file'), (req, res) => {
    const { numbers } = req.body;
    numberArray = numbers.split(",")
    const file = req.file;
    console.log(numbers, numberArray)
    if (!numbers || !file) {
        return res.status(400).json({ status: 'error', message: 'Missing numbers or file' });
    }

    const filePath = path.join(__dirname, './uploads', file.filename);
    const media = MessageMedia.fromFilePath(filePath);

    // Process each number and send the file
    const messagePromises = numberArray.map((number) => {
        const whatsappNumber = `${number.replace(/\D/g, '')}@c.us`; // Clean number format and append @c.us
        return client.sendMessage(whatsappNumber, media)
            .then(response => {
                console.log(`File sent successfully to ${number}`);
                return { number, status: 'success', response };
            })
            .catch(err => {
                console.error(`Failed to send file to ${number}`, err);
                return { number, status: 'error', error: err };
            });
    });

    // Wait for all promises to resolve before sending the final response
    Promise.all(messagePromises)
        .then(results => {
            // Remove the uploaded file after processing
            try {
                fs.unlinkSync(filePath);
                console.log(`${file.filename} deleted`);
            } catch (e) {
                console.log("File deletion failed or already deleted:", e);
            }
            
            res.status(200).json({
                status: 'success',
                message: 'File processed for all numbers',
                results
            });
        })
        .catch(error => {
            res.status(500).json({ status: 'error', message: 'Failed to process file for all numbers', error });
        });
});


// Initialize the client
client.initialize();

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
