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

const PROFONDEUR_MAX = 6; // portée de calcul de l'IA difficile

// Init clics + clavier
cells.forEach(cell=>{
  const index = parseInt(cell.dataset.index);
  cell.addEventListener("click", ()=>jouer(index));
  cell.addEventListener("keydown", e=>{
    if(e.key==="Enter" || e.key===" "){
      e.preventDefault();
      jouer(index);
    }
  });
});

// ---------- Son ----------
let contexteAudio;
function bip(frequence, duree=0.09){
  if(!sonActif) return;
  try{
    contexteAudio = contexteAudio || new (window.AudioContext||window.webkitAudioContext)();
    const osc = contexteAudio.createOscillator();
    const gain = contexteAudio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequence;
    gain.gain.setValueAtTime(0.06, contexteAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, contexteAudio.currentTime + duree);
    osc.connect(gain).connect(contexteAudio.destination);
    osc.start();
    osc.stop(contexteAudio.currentTime + duree);
  }catch(e){ /* audio indisponible, on ignore */ }
}
function toggleSon(){ sonActif = document.getElementById("sonActif").checked; }

// ---------- Jouer un coup ----------
function jouer(index, estIA=false){
  if(plateau[index]!==""||(bloque&&!estIA)) return;

  plateau[index] = joueur;
  cells[index].textContent = joueur;
  cells[index].classList.add(joueur.toLowerCase(), "pose");
  cells[index].setAttribute("aria-label", `Case ${index+1}, occupée par ${joueur}`);
  bip(joueur==="X" ? 420 : 320);
  coupsJoueurs[joueur].push(index);

  // Limite 3 pions : le plus ancien s'efface
  while(coupsJoueurs[joueur].length>3){
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
    document.getElementById("message").textContent = `${joueur} aligne trois pions et gagne !`;
    scores[joueur]++;
    updateScores();
    bip(joueur==="X" ? 600 : 500, 0.18);

    if(joueur === "X" && iaActive){
      ajusterMemoire(coupsJoueurs.X); // l'IA retient ce qui l'a fait perdre
    }

    bloque = true;
    setTimeout(()=>{ recommencer(); bloque=false; }, 1500);
    return;
  }

  // Tour suivant
  joueur = joueur === "X" ? "O" : "X";
  document.getElementById("message").textContent = `Tour du joueur ${joueur}`;
  renderFantomes();

  if(iaActive && joueur === "O"){
    bloque = true;
    setTimeout(()=>{ jouerIA(); bloque=false; }, 220);
  }
}

function ligneGagnanteDe(j){
  return combinaisons.find(c=>c.every(i=>plateau[i]===j));
}
function checkWin(board,j){
  return combinaisons.some(c=>c.every(i=>board[i]===j));
}

// Avertit visuellement quel pion s'effacera au prochain coup de son joueur
function renderFantomes(){
  cells.forEach(c=>c.classList.remove("fantome"));
  ["X","O"].forEach(j=>{
    if(coupsJoueurs[j].length===3){
      cells[coupsJoueurs[j][0]].classList.add("fantome");
    }
  });
}

// ---------- Cycle de partie ----------
function recommencer(){
  plateau = ["","","","","","","","",""];
  joueur = "X";
  coupsJoueurs = { X: [], O: [] };
  cells.forEach((c,i)=>{
    c.textContent = "";
    c.classList.remove("x","o","pose","fantome","gagnante");
    c.setAttribute("aria-label", `Case ${i+1}, vide`);
  });
  document.getElementById("message").textContent = `Tour du joueur ${joueur}`;
}

function updateScores(){
  document.getElementById("scoreX").textContent = scores.X;
  document.getElementById("scoreO").textContent = scores.O;
}
function resetScores(){
  scores = { X:0, O:0 };
  updateScores();
}
function reinitialiserMemoireIA(){
  memoireIA = {};
  document.getElementById("message").textContent = "L'IA a oublié ses défaites passées.";
}

// ---------- Contrôles ----------
function resetPage(){ location.reload(); }
function toggleIA(){
  iaActive = !iaActive;
  document.getElementById("iaStatus").textContent = iaActive ? "activé" : "désactivé";
  recommencer();
}
function changerNiveauIA(){
  niveauIA = document.getElementById("niveauIA").value;
  recommencer();
}
function toggleTutoriel(){
  tutorielIA = document.getElementById("tutorielIA").checked;
  document.getElementById("tutorielIAContainer").hidden = !tutorielIA;
}

// ---------- Mémoire post-défaite ----------
function ajusterMemoire(coupsJoueur){
  coupsJoueur.forEach(pos=>{
    memoireIA[pos] = (memoireIA[pos] || 0) + 1;
  });
}

// ---------- IA ----------
function jouerIA(){
  let index;
  if(niveauIA === "facile") index = iaFacile();
  else if(niveauIA === "normal") index = iaAdaptative();
  else index = iaDifficile();

  if(index === undefined) index = iaFacile();
  if(tutorielIA) montrerAnalyse(index);
  jouer(index, true);
}

function casesVides(){
  return plateau.map((v,i)=>v===""?i:null).filter(i=>i!==null);
}

// Repère un coup qui ferait gagner `j` immédiatement, s'il existe
function trouverCoupGagnant(board, j){
  const vides = board.map((v,i)=>v===""?i:null).filter(i=>i!==null);
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

  for(let idx of vides){
    let score = 0;
    if(memoireIA[idx]) score += memoireIA[idx]*5;

    combinaisons.forEach(c=>{
      if(c.includes(idx)){
        const ligne = c.map(i=>plateau[i]);
        if(ligne.filter(v=>v==="O").length===2 && ligne.includes("")) score += 10;
        if(ligne.filter(v=>v==="X").length===2 && ligne.includes("")) score += 8;
        if(ligne.filter(v=>v==="O").length===1) score += 2;
        if(ligne.filter(v=>v==="X").length===1) score += 1;
      }
    });

    if(score > scoreMax){
      scoreMax = score;
      meilleur = idx;
    }
  }
  return meilleur;
}

// ---------- Facile · QI 50 ----------
// Joue presque toujours au hasard. Ne remarque un gain immédiat que rarement,
// et ne pense jamais à bloquer l'adversaire.
function iaFacile(){
  const vides = casesVides();
  if(Math.random() < 0.15){
    const coupGagnant = trouverCoupGagnant(plateau, "O");
    if(coupGagnant !== undefined) return coupGagnant;
  }
  return vides[Math.floor(Math.random()*vides.length)];
}

// ---------- Normal · QI 80 ----------
// Suit un raisonnement correct un peu plus d'une fois sur deux ; le reste du
// temps elle se disperse et joue une case au hasard, comme une joueuse
// moyenne qui perd parfois le fil.
function iaAdaptative(){
  const vides = casesVides();
  if(Math.random() < 0.55){
    return meilleurCoupHeuristique();
  }
  return vides[Math.floor(Math.random()*vides.length)];
}

// ---------- IA difficile : minimax alpha-bêta, profondeur limitée ----------
// Le plateau ne se remplit jamais totalement (3 pions max par joueur), donc
// l'ancien minimax "plein plateau" ne pouvait jamais atteindre un vrai match nul
// et sa branche de minimisation ne suivait pas correctement le score minimum.
// Cette version simule aussi la disparition des pions et limite la profondeur.
function iaDifficile(){
  const etat = {
    board: [...plateau],
    queues: { X: [...coupsJoueurs.X], O: [...coupsJoueurs.O] }
  };
  const resultat = minimax(etat, "O", PROFONDEUR_MAX, -Infinity, Infinity);
  return resultat.index !== undefined ? resultat.index : iaAdaptative();
}

function appliquerCoup(etat, index, j){
  const suivant = {
    board: [...etat.board],
    queues: { X: [...etat.queues.X], O: [...etat.queues.O] }
  };
  suivant.board[index] = j;
  suivant.queues[j].push(index);
  if(suivant.queues[j].length>3){
    const ancien = suivant.queues[j].shift();
    suivant.board[ancien] = "";
  }
  return suivant;
}

function minimax(etat, joueurActuel, profondeur, alpha, beta){
  if(checkWin(etat.board,"X")) return { score: -1000 - profondeur };
  if(checkWin(etat.board,"O")) return { score: 1000 + profondeur };

  const vides = etat.board.map((v,i)=>v===""?i:null).filter(i=>i!==null);
  if(profondeur===0 || vides.length===0){
    return { score: evaluerPlateau(etat.board) };
  }

  let meilleurCoup = { index: vides[0], score: joueurActuel==="O" ? -Infinity : Infinity };

  if(joueurActuel==="O"){
    let max = -Infinity;
    for(const i of vides){
      const suivant = appliquerCoup(etat, i, "O");
      const res = minimax(suivant, "X", profondeur-1, alpha, beta);
      if(res.score > max){ max = res.score; meilleurCoup = { index:i, score:res.score }; }
      alpha = Math.max(alpha, res.score);
      if(beta <= alpha) break;
    }
  } else {
    let min = Infinity;
    for(const i of vides){
      const suivant = appliquerCoup(etat, i, "X");
      const res = minimax(suivant, "O", profondeur-1, alpha, beta);
      if(res.score < min){ min = res.score; meilleurCoup = { index:i, score:res.score }; }
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
    const countO = ligne.filter(v=>v==="O").length;
    const countX = ligne.filter(v=>v==="X").length;
    if(countO>0 && countX>0) return; // ligne neutralisée
    if(countO===2) score += 10;
    else if(countO===1) score += 1;
    if(countX===2) score -= 10;
    else if(countX===1) score -= 1;
  });
  return score;
}

// ---------- Tutoriel IA ----------
function montrerAnalyse(index){
  const tutorielCells = document.querySelectorAll(".caseTutoriel");
  const vides = plateau.map((v,i)=>v===""?i:null).filter(i=>i!==null);
  const scoresCases = Array(9).fill(0);
  vides.forEach(i=>{ scoresCases[i] = evaluerCase(i,"O"); });
  tutorielCells.forEach((c,i)=>{
    c.classList.remove("choisie");
    c.textContent = plateau[i]==="" ? (scoresCases[i] || "0") : "";
  });
  tutorielCells[index].classList.add("choisie");
}

function evaluerCase(idx){
  let score = 0;
  combinaisons.forEach(c=>{
    if(c.includes(idx)){
      const ligne = c.map(i=>plateau[i]);
      const countO = ligne.filter(v=>v==="O").length;
      const countX = ligne.filter(v=>v==="X").length;
      if(countO===2 && ligne.includes("")) score += 10;
      else if(countX===2 && ligne.includes("")) score += 8;
      else if(countO===1) score += 3;
      else if(countX===1) score += 2;
    }
  });
  return score;
}

// ---------- Popup infos ----------
function toggleInfo(){
  const popup = document.getElementById("infoPopup");
  popup.style.display = popup.style.display==="block" ? "none" : "block";
}
