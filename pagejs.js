let currentSlide = 0;
const images = document.querySelectorAll('.gallery img');

function changeSlide(direction) {
  images[currentSlide].classList.remove('active');
  currentSlide = (currentSlide + direction + images.length) % images.length;
  images[currentSlide].classList.add('active');
}

images.forEach((image, index) => {
  image.addEventListener('click', () => {
    changeSlide(index - currentSlide);
  });
});
