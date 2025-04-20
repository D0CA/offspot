#!/bin/bash

# ✅ Couleurs
RED="\033[0;31m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
RESET="\033[0m"

echo -e "${CYAN}🔧 Initialisation de l'environnement local OffSpot...${RESET}"

# 🔁 Backend
echo -e "${BLUE}🚀 Lancement du backend sur http://localhost:4000...${RESET}"
cd backend
npm run start:local | sed 's/^/[BACKEND] /' &
BACKEND_PID=$!
cd ..

# 🔁 Frontend
echo -e "${BLUE}🚀 Lancement du frontend sur http://localhost:5173...${RESET}"
cd frontend
npm run dev:local | sed 's/^/[FRONTEND] /' &
FRONTEND_PID=$!
cd ..

# ✅ Infos
echo -e "\n${GREEN}✅ Serveurs lancés avec succès !${RESET}"
echo -e "${CYAN}👉 Accède à ton jeu ici : ${BLUE}http://localhost:5173${RESET}"
echo -e "${CYAN}🛑 Appuie sur Entrée pour tout arrêter proprement.${RESET}"

# Pause utilisateur
read

# 🔻 Stop des serveurs
kill $BACKEND_PID
kill $FRONTEND_PID

echo -e "${RED}🧹 Serveurs arrêtés.${RESET}"
