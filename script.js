let fullAcervo = [];

async function loadAcervo() {
    try {
        const res = await fetch('acervo.json');
        fullAcervo = await res.json();
        renderAcervo(fullAcervo);
    } catch (e) {
        console.error('Erro ao carregar acervo:', e);
        document.getElementById('acervo-grid').innerHTML =
            '<p>Não foi possível carregar os acervo agora.</p>';
    }
}

function renderAcervo(acervo) {
    const grid = document.getElementById('acervo-grid');

    grid.innerHTML = acervo.map(tema => `
      <article class="card">
        <div class="card-images">
          ${(tema.images || []).map(img => `<img src="images/acervo${img}" alt="${tema.title}" class="card-img">`).join('')}
        </div>
        <div class="card-content">
          <h3>${tema.title}</h3>
          <p>${tema.description}</p>
          <div class="categorias">
            ${(tema.categorias || []).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          <div class="card-actions">
            <a class="button" href="https://wa.me/5551990163918?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20kit%20${encodeURIComponent(tema.title)}" target="_blank">Quero reservar</a>
          </div>
        </div>
      </article>
    `).join('');

    // Add click event to open modal with carousel
    let currentImages = [];
    let currentIndex = 0;

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
            const images = Array.from(card.querySelectorAll('.card-img'));
            currentImages = images.map(img => ({ src: img.src, alt: img.alt }));
            currentIndex = 0;
            updateCarousel();
            document.getElementById('image-modal').style.display = 'flex';
        });
    });

    function updateCarousel() {
        const imgElement = document.getElementById('carousel-img');
        imgElement.src = currentImages[currentIndex].src;
        imgElement.alt = currentImages[currentIndex].alt;
    }

    // Carousel navigation
    document.querySelector('.prev').addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        updateCarousel();
    });

    document.querySelector('.next').addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % currentImages.length;
        updateCarousel();
    });

    // Close modal
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('image-modal').style.display = 'none';
    });

    // Close modal on outside click
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('image-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function filterAcervo(query) {
    if (!query) return fullAcervo;
    const lowerQuery = query.toLowerCase();
    return fullAcervo.filter(tema =>
        tema.title.toLowerCase().includes(lowerQuery) ||
        tema.description.toLowerCase().includes(lowerQuery) ||
        (tema.categorias || []).some(cat => cat.toLowerCase().includes(lowerQuery))
    );
}

document.addEventListener('DOMContentLoaded', () => {
    loadAcervo();
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const filtered = filterAcervo(e.target.value);
        renderAcervo(filtered);
    });

    // Add event listeners for search buttons
    document.querySelectorAll('.search-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            searchInput.value = query;
            const filtered = filterAcervo(query);
            renderAcervo(filtered);
        });
    });
});