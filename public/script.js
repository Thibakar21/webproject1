document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('codeInput');
    const generateBtn = document.getElementById('generateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const btnText = document.querySelector('.btn-text');
    const btnSpinner = document.getElementById('btnSpinner');
    const emptyState = document.getElementById('emptyState');
    const markdownOutput = document.getElementById('markdownOutput');
    const toast = document.getElementById('toast');
    
    // V2 Items
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const historyList = document.getElementById('historyList');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

    let currentMarkdown = '';

    // ============================================
    // V2: History Logic
    // ============================================
    async function fetchHistory() {
        try {
            const res = await fetch('/api/history');
            const history = await res.json();
            
            historyList.innerHTML = '';
            
            if (history.length === 0) {
                historyList.innerHTML = '<li class="history-empty">No history found</li>';
                return;
            }

            history.forEach(item => {
                const li = document.createElement('li');
                li.className = 'history-item';
                const date = new Date(item.timestamp).toLocaleString();
                li.innerHTML = `
                    <div class="history-title">${item.title}</div>
                    <div class="history-time">${date}</div>
                `;
                li.addEventListener('click', () => loadHistoryItem(item.id));
                historyList.appendChild(li);
            });
        } catch (e) {
            console.error(e);
        }
    }

    async function loadHistoryItem(id) {
        try {
            const res = await fetch(`/api/history/${id}`);
            const item = await res.json();
            
            codeInput.value = item.code;
            currentMarkdown = item.documentation;
            
            markdownOutput.innerHTML = marked.parse(currentMarkdown);
            emptyState.classList.add('hide');
            markdownOutput.classList.remove('hide');
        } catch (e) {
            showToast('Failed to load history item', 'error');
        }
    }

    refreshHistoryBtn.addEventListener('click', fetchHistory);

    // ============================================
    // V2: File Upload Logic
    // ============================================
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Visual loading state
        generateBtn.disabled = true;
        btnText.textContent = 'Processing File...';
        btnSpinner.classList.remove('hide');
        uploadBtn.disabled = true;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload-generate', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            // Populate UI
            codeInput.value = data.code;
            currentMarkdown = data.documentation;
            markdownOutput.innerHTML = marked.parse(currentMarkdown);
            
            emptyState.classList.add('hide');
            markdownOutput.classList.remove('hide');
            
            showToast('File documented successfully!', 'success');
            
            // Auto refresh history
            fetchHistory();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            generateBtn.disabled = false;
            uploadBtn.disabled = false;
            btnText.textContent = 'Generate Docs';
            btnSpinner.classList.add('hide');
            fileInput.value = ''; // Reset input
        }
    });

    // ============================================
    // V1: Manual Paste Generation
    // ============================================
    generateBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (!code) {
            showToast('Please paste some code first!', 'error');
            return;
        }

        generateBtn.disabled = true;
        btnText.textContent = 'Generating...';
        btnSpinner.classList.remove('hide');

        try {
            const response = await fetch('/api/generate-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to generate');

            currentMarkdown = data.documentation;
            markdownOutput.innerHTML = marked.parse(currentMarkdown);
            
            emptyState.classList.add('hide');
            markdownOutput.classList.remove('hide');
            
            showToast('Documentation generated successfully!', 'success');
            
            // Auto refresh history
            fetchHistory();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            generateBtn.disabled = false;
            btnText.textContent = 'Generate Docs';
            btnSpinner.classList.add('hide');
        }
    });

    // ============================================
    // Utilities
    // ============================================
    copyBtn.addEventListener('click', () => {
        if (!currentMarkdown) return;
        
        navigator.clipboard.writeText(currentMarkdown).then(() => {
            showToast('Copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy', 'error');
        });
    });

    let toastTimeout;
    function showToast(message, type = 'success') {
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Init
    fetchHistory();
});
