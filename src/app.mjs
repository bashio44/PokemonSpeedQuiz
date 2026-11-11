import {
  STARTING_TIME,
  applyTimeChange,
  createQuestion,
  filterPokemon,
  getSpriteCandidates,
  getTimeChange,
} from "./game.mjs";

const byId = (id) => document.getElementById(id);
const pokemonDisplayName = (pokemon) => pokemon.form ? `${pokemon.name}（${pokemon.form}）` : pokemon.name;
const homeScreen = byId("home-screen");
const gameScreen = byId("game-screen");
const resultScreen = byId("result-screen");
const finalOnlyInput = byId("final-only");
const regulationOnlyInput = byId("regulation-only");
const startButton = byId("start-button");
const timerTrack = document.querySelector(".timer-track");
const timerFill = byId("timer-fill");
const timeLabel = byId("time-label");
const leftCard = byId("left-card");
const rightCard = byId("right-card");
const feedback = byId("answer-feedback");

let pokemonData = [];
let regulationIds = [];
let pool = [];
let currentPair = [];
let history = [];
let score = 0;
let timeLeft = STARTING_TIME;
let lastFrame = 0;
let animationFrame = 0;
let feedbackStartedAt = 0;
let gameActive = false;

async function loadData() {
  try {
    const [pokemonResponse, regulationResponse] = await Promise.all([
      fetch("./data/pokemon.json"),
      fetch("./data/regulation-mc.json"),
    ]);
    if (!pokemonResponse.ok || !regulationResponse.ok) {
      throw new Error("データファイルを読み込めませんでした。");
    }
    [pokemonData, regulationIds] = await Promise.all([
      pokemonResponse.json(),
      regulationResponse.json(),
    ]);
    refreshPoolSummary();
  } catch (error) {
    byId("load-error").textContent = `データの読み込みに失敗しました。ページを再読み込みしてください。(${error.message})`;
    byId("load-error").hidden = false;
    byId("pool-summary").textContent = "出題データを読み込めませんでした";
  }
}

function getCurrentPool() {
  return filterPokemon(
    pokemonData,
    {
      finalOnly: finalOnlyInput.checked,
      regulationOnly: regulationOnlyInput.checked,
    },
    regulationIds,
  );
}

function refreshPoolSummary() {
  pool = getCurrentPool();
  const uniqueSpeeds = new Set(pool.map((entry) => entry.stats.speed)).size;
  byId("pool-summary").textContent = `${pool.length.toLocaleString("ja-JP")}匹から出題 ・ 素早さの異なる組み合わせ ${uniqueSpeeds > 1 ? "あり" : "なし"}`;
  startButton.disabled = uniqueSpeeds < 2;
  if (uniqueSpeeds < 2) {
    byId("load-error").textContent = "この条件で出題できるポケモンが2匹以上いません。出題範囲を変更してください。";
    byId("load-error").hidden = false;
  } else {
    byId("load-error").hidden = true;
  }
}

function setScreen(screen) {
  homeScreen.hidden = screen !== "home";
  gameScreen.hidden = screen !== "game";
  resultScreen.hidden = screen !== "result";
  window.scrollTo({ top: 0, behavior: "instant" });
}

function startGame() {
  refreshPoolSummary();
  if (startButton.disabled) return;

  pool = getCurrentPool();
  history = [];
  score = 0;
  timeLeft = STARTING_TIME;
  gameActive = true;
  byId("score").textContent = "0";
  feedback.hidden = true;
  setScreen("game");
  showQuestion();
  lastFrame = performance.now();
  animationFrame = requestAnimationFrame(updateTimer);
}

function showQuestion() {
  currentPair = createQuestion(pool);
  byId("question-count").textContent = `第${history.length + 1}問`;
  populateCard(leftCard, currentPair[0]);
  populateCard(rightCard, currentPair[1]);
  leftCard.disabled = false;
  rightCard.disabled = false;
  leftCard.classList.remove("is-correct", "is-wrong");
  rightCard.classList.remove("is-correct", "is-wrong");
  feedback.hidden = true;
  updateTimerDisplay();
}

function populateCard(card, pokemon) {
  card.dataset.pokemonNo = String(pokemon.no);
  const side = card.id === "left-card" ? "左" : "右";
  const displayName = pokemonDisplayName(pokemon);
  card.setAttribute("aria-label", `${side}の${displayName}を選ぶ`);
  card.querySelector(".pokemon-number").textContent = `No.${String(pokemon.no).padStart(3, "0")}`;
  card.querySelector(".pokemon-name").textContent = displayName;
  card.querySelector(".speed-value").textContent = "";
  const image = card.querySelector(".pokemon-image");
  const candidates = getSpriteCandidates(pokemon.no);
  let index = 0;
  image.onerror = () => {
    index += 1;
    if (index < candidates.length) {
      image.src = candidates[index];
    } else {
      image.onerror = null;
      image.classList.add("image-unavailable");
      image.alt = "画像なし";
    }
  };
  image.classList.remove("image-unavailable");
  image.alt = `${displayName}の画像`;
  image.src = candidates[0];
}

function updateTimer(now) {
  if (!gameActive) return;
  timeLeft = Math.max(0, timeLeft - (now - lastFrame) / 1000);
  lastFrame = now;
  updateTimerDisplay();

  if (timeLeft <= 0) {
    const feedbackStillVisible = !feedback.hidden && now - feedbackStartedAt < 720;
    if (!feedbackStillVisible) {
      endGame();
      return;
    }
  }
  animationFrame = requestAnimationFrame(updateTimer);
}

function updateTimerDisplay() {
  const seconds = Math.max(0, timeLeft);
  const percentage = (seconds / STARTING_TIME) * 100;
  timerFill.style.width = `${percentage}%`;
  timerFill.classList.toggle("is-low", seconds <= 8);
  timeLabel.innerHTML = `${seconds.toFixed(1)}<span>秒</span>`;
  timerTrack.setAttribute("aria-valuenow", seconds.toFixed(1));
}

function answer(side) {
  if (!gameActive || leftCard.disabled) return;

  const selectedPokemon = side === "left" ? currentPair[0] : currentPair[1];
  const correctPokemon = currentPair[0].stats.speed > currentPair[1].stats.speed ? currentPair[0] : currentPair[1];
  const isCorrect = selectedPokemon === correctPokemon;
  const change = getTimeChange(history.length, isCorrect);

  history.push({
    left: currentPair[0],
    right: currentPair[1],
    selectedSide: side,
    correctSide: correctPokemon === currentPair[0] ? "left" : "right",
    isCorrect,
    change,
  });
  if (isCorrect) score += 1;
  timeLeft = applyTimeChange(timeLeft, change);
  updateTimerDisplay();
  byId("score").textContent = String(score);
  leftCard.disabled = true;
  rightCard.disabled = true;
  showAnswer(isCorrect, change, correctPokemon);
  feedbackStartedAt = performance.now();

  window.setTimeout(() => {
    if (!gameActive) return;
    if (timeLeft <= 0) {
      endGame();
    } else {
      showQuestion();
    }
  }, 720);
}

function showAnswer(isCorrect, change, correctPokemon) {
  currentPair.forEach((pokemon, index) => {
    const card = index === 0 ? leftCard : rightCard;
    card.querySelector(".speed-value").textContent = `すばやさ ${pokemon.stats.speed}`;
    card.classList.add(pokemon === correctPokemon ? "is-correct" : "is-wrong");
  });
  byId("feedback-mark").textContent = isCorrect ? "✓" : "×";
  byId("feedback-mark").className = `feedback-mark ${isCorrect ? "mark-correct" : "mark-wrong"}`;
  byId("feedback-title").textContent = isCorrect ? "正解！" : "不正解…";
  const sign = change > 0 ? "+" : "−";
  byId("feedback-change").textContent = `${sign}${Math.abs(change).toFixed(1)}秒`;
  feedback.className = `answer-feedback ${isCorrect ? "feedback-correct" : "feedback-wrong"}`;
  feedback.hidden = false;
}

function endGame() {
  if (!gameActive) return;
  gameActive = false;
  cancelAnimationFrame(animationFrame);
  setScreen("result");
  byId("final-score").textContent = String(score);
  byId("result-detail").textContent = `${history.length}問中 ${score}問正解　・　正解率 ${history.length ? Math.round((score / history.length) * 100) : 0}%`;
  renderHistory();
}

function renderHistory() {
  const list = byId("answer-history");
  list.replaceChildren();
  byId("empty-history").hidden = history.length > 0;

  history.forEach((answer, index) => {
    const item = document.createElement("li");
    item.className = `history-card ${answer.isCorrect ? "history-correct" : "history-wrong"}`;
    const heading = document.createElement("div");
    heading.className = "history-heading";
    const questionNumber = document.createElement("strong");
    questionNumber.textContent = `Q${String(index + 1).padStart(2, "0")}`;
    const verdict = document.createElement("span");
    verdict.textContent = answer.isCorrect ? `正解　+${answer.change.toFixed(1)}秒` : `不正解　−${Math.abs(answer.change).toFixed(1)}秒`;
    heading.append(questionNumber, verdict);

    const options = document.createElement("div");
    options.className = "history-options";
    [answer.left, answer.right].forEach((pokemon, optionIndex) => {
      const option = document.createElement("div");
      const side = optionIndex === 0 ? "left" : "right";
      option.className = `history-option ${side === answer.correctSide ? "history-option-correct" : ""}`;
      const name = document.createElement("span");
      name.textContent = pokemonDisplayName(pokemon);
      const speed = document.createElement("strong");
      speed.textContent = String(pokemon.stats.speed);
      option.append(name, speed);
      options.append(option);
    });

    const chosen = document.createElement("p");
    const chosenPokemon = answer.selectedSide === "left" ? answer.left : answer.right;
    const correctPokemon = answer.correctSide === "left" ? answer.left : answer.right;
    chosen.className = "history-choice";
    chosen.textContent = `あなたの回答：${pokemonDisplayName(chosenPokemon)}　／　正解：${pokemonDisplayName(correctPokemon)}`;
    item.append(heading, options, chosen);
    list.append(item);
  });
}

async function shareResult() {
  const attempts = history.length;
  const accuracy = attempts ? Math.round((score / attempts) * 100) : 0;
  const shareText = `ポケスピ！で ${attempts}問中${score}問正解（正解率${accuracy}%）⚡\nあなたも挑戦！ ${window.location.href}`;
  const status = byId("share-status");

  try {
    if (navigator.share) {
      await navigator.share({ title: "ポケスピ！", text: shareText });
      status.textContent = "共有画面を開きました！";
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      status.textContent = "結果をコピーしました。SNSに貼り付けてシェアしよう！";
    } else {
      status.textContent = "このブラウザでは共有できません。画面をスクリーンショットしてシェアしてね！";
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    status.textContent = `共有に失敗しました：${error.message}`;
  }
}

finalOnlyInput.addEventListener("change", refreshPoolSummary);
regulationOnlyInput.addEventListener("change", refreshPoolSummary);
startButton.addEventListener("click", startGame);
leftCard.addEventListener("click", () => answer("left"));
rightCard.addEventListener("click", () => answer("right"));
byId("retry-button").addEventListener("click", () => {
  setScreen("home");
  startGame();
});
byId("home-button").addEventListener("click", () => setScreen("home"));
byId("share-button").addEventListener("click", shareResult);

loadData();
