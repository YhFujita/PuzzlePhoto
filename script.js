document.addEventListener('DOMContentLoaded', () => {
    // Disable right-click context menu
    document.addEventListener('contextmenu', event => event.preventDefault());

    const puzzleBoard = document.getElementById('puzzle-board');
    const imageUpload = document.getElementById('image-upload');
    const difficultyBtns = document.querySelectorAll('.difficulty-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const successModal = document.getElementById('success-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    let currentImage = null;
    let gridSize = 2; // Default 2x2
    let pieces = [];
    let isGameActive = false;

    // --- Event Listeners ---
    imageUpload.addEventListener('change', handleImageUpload);
    rotateBtn.addEventListener('click', handleRotate);

    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            difficultyBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            gridSize = parseInt(e.target.dataset.grid);
            if (currentImage) {
                initGame(currentImage, false); // Re-init without shuffle first to show grid
            }
        });
    });

    shuffleBtn.addEventListener('click', () => {
        if (!currentImage) {
            alert('まずは画像をアップロードしてください！');
            return;
        }
        initGame(currentImage, true);
    });

    closeModalBtn.addEventListener('click', () => {
        successModal.classList.add('hidden');
    });

    // --- Core Functions ---

    function handleRotate() {
        if (!currentImage) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Swap dimensions
            canvas.width = currentImage.height;
            canvas.height = currentImage.width;

            // Rotate 90 degrees clockwise
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(90 * Math.PI / 180);
            ctx.drawImage(img, -currentImage.width / 2, -currentImage.height / 2);

            const newSrc = canvas.toDataURL();

            // Update currentImage
            currentImage = {
                src: newSrc,
                width: canvas.width,
                height: canvas.height,
                ratio: canvas.width / canvas.height
            };

            initGame(currentImage, false);
        };
        img.src = currentImage.src;
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                currentImage = {
                    src: event.target.result,
                    width: img.width,
                    height: img.height,
                    ratio: img.width / img.height
                };
                initGame(currentImage, false);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function initGame(imageObj, shouldShuffle) {
        puzzleBoard.innerHTML = '';
        pieces = [];

        // Adjust Aspect Ratio
        const gameArea = document.querySelector('.game-area');

        // Calculate max dimensions
        // Get container width - padding is handled by game-area constraints, but let's be safe
        // game-area has max-height 70vh, width 100% of parent (max 600px - padding)

        // We will calculate optimal size that fits in 100% width AND 70vh height
        const maxWidth = gameArea.clientWidth;
        const maxHeight = window.innerHeight * 0.7; // 70vh approximation

        let targetWidth = maxWidth;
        let targetHeight = targetWidth / imageObj.ratio;

        // If height is too big, scale down based on height
        if (targetHeight > maxHeight) {
            targetHeight = maxHeight;
            targetWidth = targetHeight * imageObj.ratio;
        }

        puzzleBoard.style.width = `${targetWidth}px`;
        puzzleBoard.style.height = `${targetHeight}px`;

        // CSS Grid setup
        puzzleBoard.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
        puzzleBoard.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

        const imageSrc = imageObj.src;
        const totalPieces = gridSize * gridSize;
        const indexes = Array.from({ length: totalPieces }, (_, i) => i);

        if (shouldShuffle) {
            // Fisher-Yates shuffle ensuring it's not solved initially
            do {
                for (let i = indexes.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
                }
            } while (checkIfSolved(indexes)); // Prevent already solved state
            isGameActive = true;
        } else {
            isGameActive = false;
        }

        // Create pieces
        for (let pos = 0; pos < totalPieces; pos++) {
            const pieceIndex = indexes[pos]; // Which part of image goes here
            const piece = createPiece(imageSrc, pieceIndex, pos);
            puzzleBoard.appendChild(piece);
            pieces.push({
                element: piece,
                currentPos: pos,
                correctPos: pieceIndex
            });
        }
    }

    function createPiece(imageSrc, index, currentPos) {
        const div = document.createElement('div');
        div.classList.add('puzzle-piece');
        div.draggable = true;

        // Calculate background position
        // Row and Col for the original image part (index)
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;

        const percentage = 100 / (gridSize - 1);

        div.style.backgroundImage = `url(${imageSrc})`;
        div.style.backgroundPosition = `calc(${col} * ${percentage}%) calc(${row} * ${percentage}%)`;
        div.style.backgroundSize = `${gridSize * 100}%`;

        div.dataset.index = index;
        div.dataset.currentPos = currentPos;

        // Add DnD Events
        addDnDEvents(div);

        return div;
    }

    // --- Drag and Drop Logic ---
    let draggedPiece = null;

    function addDnDEvents(piece) {
        piece.addEventListener('dragstart', dragStart);
        piece.addEventListener('dragover', dragOver);
        piece.addEventListener('dragleave', dragLeave);
        piece.addEventListener('drop', drop);
        piece.addEventListener('dragend', dragEnd);

        // Touch events for mobile support could be added here
        // optimizing for desktop first as per typical use case
    }

    function dragStart(e) {
        if (!isGameActive) return; // Disable drag if not shuffled
        draggedPiece = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function dragOver(e) {
        if (!isGameActive) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
    }

    function dragLeave(e) {
        this.classList.remove('drag-over');
    }

    function drop(e) {
        if (!isGameActive) return;
        e.preventDefault();
        this.classList.remove('drag-over');

        if (this === draggedPiece) return;

        // Swap Logic
        swapPieces(draggedPiece, this);

        checkWinCondition();
    }

    function dragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.puzzle-piece').forEach(p => p.classList.remove('drag-over'));
        draggedPiece = null;
    }

    function swapPieces(piece1, piece2) {
        // Visual DOM Swap
        // We can't just swap HTML because we need to keep event listeners
        // Strategy: Swap styles (backgroundPosition) and dataset.index

        // Actually, swapping the elements in DOM is cleaner for Grid layout
        // But simply swapping nodes might break the grid flow if not careful?
        // No, with grid layout and flat children, order in DOM determines position.

        // Let's swap the DOM nodes using placeholders
        const parent = puzzleBoard;
        const p1Proxy = document.createElement('div');
        const p2Proxy = document.createElement('div');

        parent.insertBefore(p1Proxy, piece1);
        parent.insertBefore(p2Proxy, piece2);

        parent.replaceChild(piece2, p1Proxy);
        parent.replaceChild(piece1, p2Proxy);

        // Update internal state
        // We don't really need to track 'pieces' array strictly if we rely on DOM order
        // but let's do it for validation.
    }

    function checkWinCondition() {
        const currentPieces = Array.from(puzzleBoard.children);
        let isSolved = true;

        currentPieces.forEach((piece, index) => {
            const correctIndex = parseInt(piece.dataset.index);
            if (correctIndex !== index) {
                isSolved = false;
            }
        });

        if (isSolved && isGameActive) {
            setTimeout(() => {
                showSuccess();
                isGameActive = false; // Disable game until reshuffled
            }, 200);
        }
    }

    function checkIfSolved(indexes) {
        for (let i = 0; i < indexes.length; i++) {
            if (indexes[i] !== i) return false;
        }
        return true;
    }

    function showSuccess() {
        successModal.classList.remove('hidden');
        fireConfetti();
    }

    function fireConfetti() {
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 5000);
        }
    }
});
