// src/utils/youtube.js

/**
 * Extrait l’ID vidéo d’une URL YouTube standard ou courte.
 * @param {string} url 
 * @returns {string|null} ID de 11 caractères ou null si invalide
 */
export function extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    return match ? match[1] : null;
  }
  
  /**
   * Vérifie qu’une URL est une vidéo YouTube valide.
   * @param {string} url 
   * @returns {boolean}
   */
  export function isValidYouTubeUrl(url) {
    return !!extractVideoId(url);
  }
  