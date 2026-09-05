"use strict";

/**
 * Tic Tac Toe Dynamique
 * Sommaire :
 *   1. État du jeu
 *   2. Préférences (thème, niveau, persistance)
 *   3. Liaison des événements
 *   4. Boucle de jeu
 *   5. Son
 *   6. IA (quatre niveaux calibrés par QI)
 *   7. Minimax alpha-bêta (très difficile)
 *   8. Tutoriel IA
 *   9. Fenêtre d'information
 */
(function(){

  // ---------------------------------------------------------------
  // 1. État du jeu
  // ---------------------------------------------------------------
  let plateau = ["","","","","","","","",""];
  let joueur = "X";
  let iaActive = false;
  let niveauIA = "normal";
  let tutorielIA = false;
  let sonActif = true;
  let scores = { X: 0, O: 0 };
  let bloque = false;
  let coupsJoueurs = { X: [], O: [] };
  let memoireIA = {}; // positions critiques renforcées après une défaite de l'IA

  const cells = document.querySelectorAll(".cell");
  const combinaisons = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  const PROFONDEUR_MAX = 6; // portée de calcul de l'IA très difficile
  const COULEURS_THEME = { sombre: "#1d2671", clair: "#b9c0d6", mixte: "#4b3f72" };

  // Éléments réutilisés fréquemment
  const elMessage = document.getElementById("message");
  const elScoreX = document.getElementById("scoreX");
  const elScoreO = document.getElementById("scoreO");
  const elIaStatus = document.getElementById("iaStatus");
  const elNiveauIA = document.getElementById("niveauIA");
  const elTheme = document.getElementById("theme");
  const elTutorielCheckbox = document.getElementById("tutorielIA");
  const elTutorielContainer = document.getElementById("tutorielIAContainer");
  const elSonCheckbox = document.getElementById("sonActif");
  const elInfoPopup = document.getElementById("infoPopup");
  const elMetaTheme = document.getElementById("metaTheme");

  // ---------------------------------------------------------------
  // 2. Préférences (thème, niveau, persistance locale)
  // ---------------------------------------------------------------
  function chargerPreferences(){
    const theme = localStorage.getItem("morpion_theme") || "sombre";
    appliquerTheme(theme);
    elTheme.value = theme;

    const niveauSauve = localStorage.getItem("morpion_niveau");
    if(niveauSauve){
      niveauIA = niveauSauve;
      elNiveauIA.value = niveauSauve;
    }
  }

  function appliquerTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    if(elMetaTheme && COULEURS_THEME[theme]){
      elMetaTheme.setAttribute("content", COULEURS_THEME[theme]);
    }
  }

  function changerTheme(){
    const theme = elTheme.value;
    appliquerTheme(theme);
    localStorage.setItem("morpion_theme", theme);
  }

  function changerNiveauIA(){
    niveauIA = elNiveauIA.value;
    localStorage.setItem("morpion_niveau", niveauIA);
    recommencer();
  }

  // ---------------------------------------------------------------
  // 3. Liaison des événements (aucun gestionnaire inline dans le HTML)
  // ---------------------------------------------------------------
  function initEvenements(){
    cells.forEach(cell=>{
      const index = parseInt(cell.dataset.index, 10);
      cell.addEventListener("click", ()=>jouer(index));
      cell.addEventListener("keydown", e=>{
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          jouer(index);
        }
      });
    });

    document.getElementById("infoBtn").addEventListener("click", toggleInfo);
    document.getElementById("btnFermerPopup").addEventListener("click", toggleInfo);
    document.getElementById("btnResetScores").addEventListener("click", resetScores);
    document.getElementById("btnIA").addEventListener("click", toggleIA);
    document.getElementById("btnOublierIA").addEventListener("click", reinitialiserMemoireIA);
    document.getElementById("btnRecharger").addEventListener("click", ()=>location.reload());

    elNiveauIA.addEventListener("change", changerNiveauIA);
    elTheme.addEventListener("change", changerTheme);
    elTutorielCheckbox.addEventListener("change", toggleTutoriel);
    elSonCheckbox.addEventListener("change", toggleSon);
  }

  // ---------------------------------------------------------------
  // 4. Boucle de jeu
  // ---------------------------------------------------------------
  function jouer(index, estIA=false){
    if(plateau[index] !== "" || (bloque && !estIA)) return;

    plateau[index] = joueur;
    cells[index].textContent = joueur;
    cells[index].classList.add(joueur.toLowerCase(), "pose");
    cells[index].setAttribute("aria-label", `Case ${index+1}, occupée par ${joueur}`);
    bip(joueur === "X" ? 420 : 320);
    coupsJoueurs[joueur].push(index);

    // Limite 3 pions : le plus ancien s'efface
    while(coupsJoueurs[joueur].length > 3){
      const ancien = coupsJoueurs[joueur].shift();
      plateau[ancien] = "";
      const c = cells[ancien];
      c.textContent = "";
      c.classList.remove("x","o","pose","fantome");
      c.setAttribute("aria-label", `Case ${ancien+1}, vide`);
    }

    const ligneGagnante = ligneGagnanteDe(joueur);
    if(ligneGagnante){
      ligneGagnante.forEach(i=>cells[i].classList.add("gagnante"));
      elMessage.textContent = `${joueur} aligne trois pions et gagne !`;
      scores[joueur]++;
      updateScores();
      bip(joueur === "X" ? 600 : 500, 0.18);

      if(joueur === "X" && iaActive){
        ajusterMemoire(coupsJoueurs.X); // l'IA retient ce qui l'a fait perdre
      }

      bloque = true;
      setTimeout(()=>{ recommencer(); bloque = false; }, 1500);
      return;
    }

    // Tour suivant
    joueur = joueur === "X" ? "O" : "X";
    elMessage.textContent = `Tour du joueur ${joueur}`;
    renderFantomes();

    if(iaActive && joueur === "O"){
      bloque = true;
      setTimeout(()=>{ jouerIA(); bloque = false; }, 220);
    }
  }

  function ligneGagnanteDe(j){
    return combinaisons.find(c=>c.every(i=>plateau[i] === j));
  }
  function checkWin(board, j){
    return combinaisons.some(c=>c.every(i=>board[i] === j));
  }

  // Avertit visuellement quel pion s'effacera au prochain coup de son joueur
  function renderFantomes(){
    cells.forEach(c=>c.classList.remove("fantome"));
    ["X","O"].forEach(j=>{
      if(coupsJoueurs[j].length === 3){
        cells[coupsJoueurs[j][0]].classList.add("fantome");
      }
    });
  }

  function recommencer(){
    plateau = ["","","","","","","","",""];
    joueur = "X";
    coupsJoueurs = { X: [], O: [] };
    cells.forEach((c,i)=>{
      c.textContent = "";
      c.classList.remove("x","o","pose","fantome","gagnante");
      c.setAttribute("aria-label", `Case ${i+1}, vide`);
    });
    elMessage.textContent = `Tour du joueur ${joueur}`;
  }

  function updateScores(){
    elScoreX.textContent = scores.X;
    elScoreO.textContent = scores.O;
  }
  function resetScores(){
    scores = { X: 0, O: 0 };
    updateScores();
  }
  function reinitialiserMemoireIA(){
    memoireIA = {};
    elMessage.textContent = "L'IA a oublié ses défaites passées.";
  }

  function toggleIA(){
    iaActive = !iaActive;
    elIaStatus.textContent = iaActive ? "activé" : "désactivé";
    recommencer();
  }
  function toggleTutoriel(){
    tutorielIA = elTutorielCheckbox.checked;
    elTutorielContainer.hidden = !tutorielIA;
  }

  function ajusterMemoire(coupsJoueur){
    coupsJoueur.forEach(pos=>{
      memoireIA[pos] = (memoireIA[pos] || 0) + 1;
    });
  }

  // ---------------------------------------------------------------
  // 5. Son (bips synthétisés, sans fichier audio externe)
  // ---------------------------------------------------------------
  let contexteAudio;
  function bip(frequence, duree = 0.09){
    if(!sonActif) return;
    try{
      contexteAudio = contexteAudio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = contexteAudio.createOscillator();
      const gain = contexteAudio.createGain();
      osc.type = "sine";
      osc.frequency.value = frequence;
      gain.gain.setValueAtTime(0.06, contexteAudio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, contexteAudio.currentTime + duree);
      osc.connect(gain).connect(contexteAudio.destination);
      osc.start();
      osc.stop(contexteAudio.currentTime + duree);
    }catch(e){ /* audio indisponible sur cet appareil : on ignore silencieusement */ }
  }
  function toggleSon(){ sonActif = elSonCheckbox.checked; }

  // ---------------------------------------------------------------
  // 6. IA — quatre niveaux calibrés comme des profils de joueur (QI)
  // ---------------------------------------------------------------
  function jouerIA(){
    let index;
    if(niveauIA === "facile") index = iaFacile();
    else if(niveauIA === "normal") index = iaAdaptative();
    else if(niveauIA === "difficile") index = iaDifficile();
    else index = iaTresDifficile();

    if(index === undefined) index = iaFacile();
    if(tutorielIA) montrerAnalyse(index);
    jouer(index, true);
  }

  function casesVides(){
    return plateau.map((v,i)=>v === "" ? i : null).filter(i=>i !== null);
  }

  // Repère un coup qui ferait gagner `j` immédiatement, s'il existe
  function trouverCoupGagnant(board, j){
    const vides = board.map((v,i)=>v === "" ? i : null).filter(i=>i !== null);
    for(const i of vides){
      const copie = [...board];
      copie[i] = j;
      if(checkWin(copie, j)) return i;
    }
    return undefined;
  }

  // Coup calculé par l'heuristique défense/attaque + mémoire des défaites
  function meilleurCoupHeuristique(){
    const vides = casesVides();
    let meilleur = vides[0];
    let scoreMax = -Infinity;

    for(const idx of vides){
      let score = 0;
      if(memoireIA[idx]) score += memoireIA[idx] * 5;

      combinaisons.forEach(c=>{
        if(c.includes(idx)){
          const ligne = c.map(i=>plateau[i]);
          if(ligne.filter(v=>v === "O").length === 2 && ligne.includes("")) score += 10;
          if(ligne.filter(v=>v === "X").length === 2 && ligne.includes("")) score += 8;
          if(ligne.filter(v=>v === "O").length === 1) score += 2;
          if(ligne.filter(v=>v === "X").length === 1) score += 1;
        }
      });

      if(score > scoreMax){
        scoreMax = score;
        meilleur = idx;
      }
    }
    return meilleur;
  }

  // Facile · QI 55 — joue presque toujours au hasard, ne remarque un gain
  // immédiat que rarement, et ne pense jamais à bloquer l'adversaire.
  function iaFacile(){
    const vides = casesVides();
    if(Math.random() < 0.15){
      const coupGagnant = trouverCoupGagnant(plateau, "O");
      if(coupGagnant !== undefined) return coupGagnant;
    }
    return vides[Math.floor(Math.random() * vides.length)];
  }

  // Normal · QI 85 — raisonne correctement environ deux fois sur trois ;
  // le reste du temps elle se disperse et joue une case au hasard.
  function iaAdaptative(){
    const vides = casesVides();
    if(Math.random() < 0.65){
      return meilleurCoupHeuristique();
    }
    return vides[Math.floor(Math.random() * vides.length)];
  }

  // Difficile · QI 105 — ne rate jamais un gain immédiat ni un blocage
  // évident, mais n'anticipe que deux coups à l'avance.
  function iaDifficile(){
    const gagnant = trouverCoupGagnant(plateau, "O");
    if(gagnant !== undefined) return gagnant;

    const blocage = trouverCoupGagnant(plateau, "X");
    if(blocage !== undefined) return blocage;

    if(Math.random() < 0.85){
      const etat = { board: [...plateau], queues: { X: [...coupsJoueurs.X], O: [...coupsJoueurs.O] } };
      const resultat = minimax(etat, "O", 2, -Infinity, Infinity);
      if(resultat.index !== undefined) return resultat.index;
    }
    return meilleurCoupHeuristique();
  }

  // Très difficile · QI 120 — minimax alpha-bêta profond, avec une petite
  // marge d'erreur : solide et prévoyante, mais pas infaillible.
  function iaTresDifficile(){
    if(Math.random() < 0.88){
      const etat = { board: [...plateau], queues: { X: [...coupsJoueurs.X], O: [...coupsJoueurs.O] } };
      const resultat = minimax(etat, "O", PROFONDEUR_MAX, -Infinity, Infinity);
      if(resultat.index !== undefined) return resultat.index;
    }
    return meilleurCoupHeuristique();
  }

  // ---------------------------------------------------------------
  // 7. Minimax alpha-bêta, profondeur limitée
  // Le plateau ne se remplit jamais totalement (3 pions max par joueur) :
  // cette version simule la disparition des pions à chaque coup simulé et
  // limite la profondeur pour rester performante.
  // ---------------------------------------------------------------
  function appliquerCoup(etat, index, j){
    const suivant = {
      board: [...etat.board],
      queues: { X: [...etat.queues.X], O: [...etat.queues.O] }
    };
    suivant.board[index] = j;
    suivant.queues[j].push(index);
    if(suivant.queues[j].length > 3){
      const ancien = suivant.queues[j].shift();
      suivant.board[ancien] = "";
    }
    return suivant;
  }

  function minimax(etat, joueurActuel, profondeur, alpha, beta){
    if(checkWin(etat.board, "X")) return { score: -1000 - profondeur };
    if(checkWin(etat.board, "O")) return { score: 1000 + profondeur };

    const vides = etat.board.map((v,i)=>v === "" ? i : null).filter(i=>i !== null);
    if(profondeur === 0 || vides.length === 0){
      return { score: evaluerPlateau(etat.board) };
    }

    let meilleurCoup = { index: vides[0], score: joueurActuel === "O" ? -Infinity : Infinity };

    if(joueurActuel === "O"){
      let max = -Infinity;
      for(const i of vides){
        const suivant = appliquerCoup(etat, i, "O");
        const res = minimax(suivant, "X", profondeur - 1, alpha, beta);
        if(res.score > max){ max = res.score; meilleurCoup = { index: i, score: res.score }; }
        alpha = Math.max(alpha, res.score);
        if(beta <= alpha) break;
      }
    } else {
      let min = Infinity;
      for(const i of vides){
        const suivant = appliquerCoup(etat, i, "X");
        const res = minimax(suivant, "O", profondeur - 1, alpha, beta);
        if(res.score < min){ min = res.score; meilleurCoup = { index: i, score: res.score }; }
        beta = Math.min(beta, res.score);
        if(beta <= alpha) break;
      }
    }
    return meilleurCoup;
  }

  // Évaluation heuristique quand la profondeur est épuisée
  function evaluerPlateau(board){
    let score = 0;
    combinaisons.forEach(c=>{
      const ligne = c.map(i=>board[i]);
      const countO = ligne.filter(v=>v === "O").length;
      const countX = ligne.filter(v=>v === "X").length;
      if(countO > 0 && countX > 0) return; // ligne neutralisée
      if(countO === 2) score += 10;
      else if(countO === 1) score += 1;
      if(countX === 2) score -= 10;
      else if(countX === 1) score -= 1;
    });
    return score;
  }

  // ---------------------------------------------------------------
  // 8. Tutoriel IA
  // ---------------------------------------------------------------
  function montrerAnalyse(index){
    const tutorielCells = document.querySelectorAll(".caseTutoriel");
    const vides = casesVides();
    const scoresCases = Array(9).fill(0);
    vides.forEach(i=>{ scoresCases[i] = evaluerCase(i); });
    tutorielCells.forEach((c,i)=>{
      c.classList.remove("choisie");
      c.textContent = plateau[i] === "" ? (scoresCases[i] || "0") : "";
    });
    tutorielCells[index].classList.add("choisie");
  }

  function evaluerCase(idx){
    let score = 0;
    combinaisons.forEach(c=>{
      if(c.includes(idx)){
        const ligne = c.map(i=>plateau[i]);
        const countO = ligne.filter(v=>v === "O").length;
        const countX = ligne.filter(v=>v === "X").length;
        if(countO === 2 && ligne.includes("")) score += 10;
        else if(countX === 2 && ligne.includes("")) score += 8;
        else if(countO === 1) score += 3;
        else if(countX === 1) score += 2;
      }
    });
    return score;
  }

  // ---------------------------------------------------------------
  // 9. Fenêtre d'information
  // ---------------------------------------------------------------
  function toggleInfo(){
    const ouverte = elInfoPopup.style.display === "block";
    elInfoPopup.style.display = ouverte ? "none" : "block";
    elInfoPopup.setAttribute("aria-hidden", ouverte ? "true" : "false");
  }

  // ---------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------
  initEvenements();
  chargerPreferences();

})();
