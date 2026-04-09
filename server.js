require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Configure Multer for file uploads (memory storage for simple text)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Database initialization
const dbPath = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([]));
}

let ai;
try {
    if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
} catch (e) {
    console.warn("GoogleGenAI initialized without API key or failed.");
}

// History endpoints
app.get('/api/history', (req, res) => {
    try {
        const history = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        // Light version without heavy markdown chunks
        const lightHistory = history.map(item => ({
            id: item.id,
            title: item.title,
            timestamp: item.timestamp
        }));
        res.json(lightHistory.reverse());
    } catch (e) {
        res.status(500).json({ error: 'Failed to read history' });
    }
});

app.get('/api/history/:id', (req, res) => {
    try {
        const history = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const item = history.find(i => i.id === req.params.id);
        if (item) res.json(item);
        else res.status(404).json({ error: 'Not found in history' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read history item' });
    }
});

// Shared AI logic
async function generateDocumentation(code) {
    if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('API Key not configured. Please add GEMINI_API_KEY in the .env file.');
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    const prompt = `
You are an advanced AI system that generates technical documentation from code repositories.
Analyze the following source code and generate complete, structured, and professional documentation in Markdown.

Use this EXACT format:
# Project Title
## Project Description
## Features
## Dependencies
## Usage Instructions

## API or CLI Documentation
- If the code contains a REST API: Document the Endpoints, Methods, Descriptions, and Request/Response Examples.
- If no REST API is present: Generate CLI usage documentation instead (including commands, parameters, and examples).

## Code Explanation
- Explain key functions and classes in simple terms

## Architecture Overview
- Describe system flow
- Provide a Mermaid diagram if possible

Ensure:
- The documentation is clean, well-structured, and easy to understand

CODE:
${code}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text;
}

function saveToHistory(title, code, documentation) {
    const history = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const newItem = {
        id: Date.now().toString(),
        title: title || 'Pasted Snippet',
        timestamp: new Date().toISOString(),
        code: code,
        documentation: documentation
    };
    history.push(newItem);
    fs.writeFileSync(dbPath, JSON.stringify(history, null, 2));
    return newItem;
}

app.post('/api/generate-docs', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || code.trim() === '') return res.status(400).json({ error: 'Source code is required' });

        const doc = await generateDocumentation(code);
        const saved = saveToHistory('Pasted Snippet', code, doc);
        
        res.json({ documentation: doc, id: saved.id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload-generate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const code = req.file.buffer.toString('utf8');
        const fileName = req.file.originalname;

        const doc = await generateDocumentation(code);
        const saved = saveToHistory(fileName, code, doc);
        
        res.json({ documentation: doc, code: code, id: saved.id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
