// Play the custom cat meow audio file
export function playMeowSound() {
  if (typeof window === 'undefined') return;
  try {
    const audio = new Audio('/meow.mp3');
    audio.volume = 0.7;
    audio.play().catch((err) => {
      console.debug('Audio play prevented before user interaction:', err);
    });
  } catch (e) {
    console.debug('Error playing sound:', e);
  }
}
