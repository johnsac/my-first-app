import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, PanResponder, Animated, TouchableWithoutFeedback, Image, Easing, Alert } from 'react-native';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const isRed = (suit) => suit === '♥' || suit === '♦';
const getValueRanking = (val) => VALUES.indexOf(val) + 1;

const createDeck = () => {
  let deck = [];
  for (let s of SUITS) {
    for (let v of VALUES) {
      deck.push({ suit: s, value: v, isFaceUp: false, id: `${v}${s}` });
    }
  }
  return deck;
};

const WINNABLE_SEEDS = {
  easy: [12345, 67890, 11111, 22222, 33333, 44444, 55555, 66666, 77777, 88888, 10203, 40506, 70809, 13579, 24680],
  normal: [99999, 12121, 34343, 56565, 78787, 90909, 23232, 45454, 67676, 89898, 12321, 45654, 78987, 10101, 20202],
  hard: [13579, 24680, 11223, 44556, 77889, 99001, 22334, 55667, 88990, 10293, 31415, 92653, 58979, 32384, 62643]
};

const mulberry32 = (a) => {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const shuffle = (deck, difficulty, seed) => {
  let d = [...deck];
  const random = seed !== undefined ? mulberry32(seed) : Math.random;

  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }

  const aces = d.filter(c => c.value === 'A');
  d = d.filter(c => c.value !== 'A');

  if (difficulty === 'easy') {
    d.splice(20, 0, aces[0]);
    d.splice(22, 0, aces[1]);
    d.splice(44, 0, aces[2]);
    d.splice(51, 0, aces[3]);
  } else if (difficulty === 'hard') {
    d.splice(45, 0, aces[0]); 
    d.splice(46, 0, aces[1]);
    d.splice(47, 0, aces[2]);
    d.splice(48, 0, aces[3]);
  } else {
    for (let a of aces) {
      const idx = Math.floor(random() * (d.length + 1));
      d.splice(idx, 0, a);
    }
  }
  return d;
};

const dropZones = {};
let globalAttemptMove = () => false;
let globalAutoMove = () => false;
let globalSetDraggingPile = () => {};
let globalPlaySound = () => {};
let globalCardBackColor = 'blue';

const registerDropZone = (type, index, layout) => {
  dropZones[`${type}-${index}`] = { type, index, layout };
};

const WinScreen = ({ onNextGame }) => {
  const { width, height } = Dimensions.get('window');
  
  const cards = React.useMemo(() => {
    let d = [];
    for (let s of SUITS) {
      for (let v of VALUES) {
        d.push({ suit: s, value: v, isFaceUp: true, id: `win-${v}${s}` });
      }
    }
    return d.sort(() => Math.random() - 0.5);
  }, []);

  const anims = useRef(cards.map(() => new Animated.ValueXY({ x: Math.random() * (width - 60), y: -100 }))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) => {
      return Animated.parallel([
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(anim.y, {
            toValue: height - 100, // roughly cardHeight
            duration: 1500,
            easing: Easing.bounce,
            useNativeDriver: false
          })
        ]),
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(anim.x, {
            toValue: anim.x._value + (Math.random() - 0.5) * 150,
            duration: 1500,
            useNativeDriver: false
          })
        ])
      ]);
    });
    
    Animated.stagger(20, animations).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(22, 101, 52, 0.9)', zIndex: 10000, justifyContent: 'center', alignItems: 'center' }]}>
      {cards.map((card, i) => (
        <Animated.View key={card.id} style={{ position: 'absolute', left: anims[i].x, top: anims[i].y }}>
          <CardDisplay card={card} />
        </Animated.View>
      ))}
      
      <View style={{ position: 'absolute', top: 100, alignItems: 'center' }}>
        <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#ffd700', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 }}>YOU WIN!</Text>
      </View>

      <TouchableOpacity 
        style={{ backgroundColor: '#fbbf24', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, zIndex: 10001, elevation: 11, marginTop: 100 }}
        onPress={onNextGame}
      >
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1f2937' }}>Next Game</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function App() {
  const [gameState, setGameState] = useState('menu'); 
  const [cardBackColor, setCardBackColor] = useState('blue');
  globalCardBackColor = cardBackColor;
  const [drawCount, setDrawCount] = useState(3); // Default to 3
  const [difficulty, setDifficulty] = useState('normal');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const [stock, setStock] = useState([]);
  const [waste, setWaste] = useState([]);
  const [foundations, setFoundations] = useState([[], [], [], []]);
  const [tableau, setTableau] = useState([[], [], [], [], [], [], []]);
  
  const [wasteDrawCount, setWasteDrawCount] = useState(0);
  const [time, setTime] = useState(0);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  
  const [history, setHistory] = useState([]);
  const [hinting, setHinting] = useState(null);
  const [activeDragLoc, setActiveDragLoc] = useState(null); 
  const [isCascading, setIsCascading] = useState(false);
  const [cascadeQueue, setCascadeQueue] = useState([]);
  const [flyingData, setFlyingData] = useState(null);
  const flyAnim = useRef(new Animated.ValueXY()).current;

  globalSetDraggingPile = setActiveDragLoc;

  const playSound = () => {};
  globalPlaySound = playSound;

  useEffect(() => {
    let interval = null;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const saveHistory = (st = stock, w = waste, f = foundations, t = tableau, sc = score, m = moves, wdc = wasteDrawCount) => {
    const snap = {
      stock: JSON.stringify(st),
      waste: JSON.stringify(w),
      foundations: JSON.stringify(f),
      tableau: JSON.stringify(t),
      score: sc,
      moves: m,
      wasteDrawCount: wdc
    };
    setHistory(prev => [...prev, snap]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setStock(JSON.parse(lastState.stock));
    setWaste(JSON.parse(lastState.waste));
    setFoundations(JSON.parse(lastState.foundations));
    setTableau(JSON.parse(lastState.tableau));
    setScore(lastState.score);
    setMoves(lastState.moves);
    setWasteDrawCount(lastState.wasteDrawCount || 0);
    setHistory(history.slice(0, -1));
    playSound();
  };

  const initializeGame = (selectedDrawCount, selectedDifficulty) => {
    setDrawCount(selectedDrawCount);
    setDifficulty(selectedDifficulty);
    playSound();
    
    const seedList = WINNABLE_SEEDS[selectedDifficulty] || WINNABLE_SEEDS['normal'];
    const randomSeed = seedList[Math.floor(Math.random() * seedList.length)];
    
    const deck = shuffle(createDeck(), selectedDifficulty, randomSeed);
    const newTableau = [[], [], [], [], [], [], []];
    
    for (let i = 0; i < 7; i++) {
      for (let j = i; j < 7; j++) {
        const card = deck.pop();
        if (i === j) card.isFaceUp = true;
        newTableau[j].push(card);
      }
    }
    
    setTableau(newTableau);
    setStock(deck);
    setWaste([]);
    setWasteDrawCount(0);
    setFoundations([[], [], [], []]);
    setTime(0);
    setMoves(0);
    setScore(0);
    setHistory([]);
    setGameState('playing');
  };

  const checkWinCondition = (newFoundations) => {
    const isWin = newFoundations.every(f => f.length === 13);
    if (isWin) setGameState('animating_win');
  };

  const checkGameOverCondition = (currentStock, currentWaste, currentFoundations, currentTableau) => {
    const allAvailable = [...currentStock, ...currentWaste];
    for (let card of allAvailable) {
      for (let f = 0; f < 4; f++) if (checkValidMove(card, 'foundation', f, false, currentFoundations, currentTableau)) return false;
      for (let t = 0; t < 7; t++) if (checkValidMove(card, 'tableau', t, false, currentFoundations, currentTableau)) return false;
    }
    for (let tSrc = 0; tSrc < 7; tSrc++) {
      const pile = currentTableau[tSrc];
      for (let cSrc = 0; cSrc < pile.length; cSrc++) {
        if (!pile[cSrc].isFaceUp) continue;
        const card = pile[cSrc];
        const isMultiple = cSrc < pile.length - 1;
        if (!isMultiple) {
          for (let f = 0; f < 4; f++) if (checkValidMove(card, 'foundation', f, false, currentFoundations, currentTableau)) return false;
        }
        for (let tDest = 0; tDest < 7; tDest++) {
          if (tSrc === tDest) continue;
          if (card.value === 'K' && cSrc === 0 && currentTableau[tDest].length === 0) continue;
          if (checkValidMove(card, 'tableau', tDest, isMultiple, currentFoundations, currentTableau)) return false;
        }
      }
    }
    return true;
  };

  const handleStockTap = () => {
    saveHistory(stock, waste, foundations, tableau, score, moves);
    playSound();

    let newStock = [...stock];
    let newWaste = [...waste];
    
    if (newStock.length === 0) {
      if (newWaste.length === 0) return; 
      newStock = newWaste.reverse().map(c => ({ ...c, isFaceUp: false }));
      newWaste = [];
      setStock(newStock);
      setWaste(newWaste);
      setScore(s => Math.max(0, s - 100));
    } else {
      const limit = Math.min(drawCount, newStock.length);
      for (let i = 0; i < limit; i++) {
        const card = newStock.pop();
        card.isFaceUp = true;
        newWaste.push(card);
      }
      setStock(newStock);
      setWaste(newWaste);
    }
    
    setMoves(m => m + 1);
  };

  const checkValidMove = (baseCard, destLocation, destPileIndex, isMultipleMoving, currentFoundations, currentTableau) => {
    if (destLocation === 'foundation') {
      if (isMultipleMoving) return false;
      const targetPile = currentFoundations[destPileIndex];
      if (targetPile.length === 0) {
        return baseCard.value === 'A';
      } else {
        const topCard = targetPile[targetPile.length - 1];
        return baseCard.suit === topCard.suit && getValueRanking(baseCard.value) === getValueRanking(topCard.value) + 1;
      }
    } else if (destLocation === 'tableau') {
      const targetPile = currentTableau[destPileIndex];
      if (targetPile.length === 0) {
        return baseCard.value === 'K';
      } else {
        const topCard = targetPile[targetPile.length - 1];
        return topCard.isFaceUp && isRed(baseCard.suit) !== isRed(topCard.suit) && getValueRanking(baseCard.value) === getValueRanking(topCard.value) - 1;
      }
    }
    return false;
  };

  const attemptMove = (srcLocation, srcPileIndex, srcCardIndex, destLocation, destPileIndex) => {
    if (srcLocation === destLocation && srcPileIndex === destPileIndex) return false;

    let movingCards = [];
    if (srcLocation === 'waste') movingCards = [waste[waste.length - 1]];
    else if (srcLocation === 'tableau') movingCards = tableau[srcPileIndex].slice(srcCardIndex);
    else if (srcLocation === 'foundation') movingCards = [foundations[srcPileIndex][foundations[srcPileIndex].length - 1]];

    if (!movingCards || movingCards.length === 0 || !movingCards[0]) return false;
    const baseCard = movingCards[0];
    const isMultipleMoving = movingCards.length > 1;

    let isValidMove = checkValidMove(baseCard, destLocation, destPileIndex, isMultipleMoving, foundations, tableau);

    if (isValidMove) {
      playSound();
      saveHistory(stock, waste, foundations, tableau, score, moves);
      let newFoundations = [...foundations];
      let newTableau = [...tableau];
      
      let nextScore = score;
      if (destLocation === 'foundation') {
        newFoundations[destPileIndex] = [...newFoundations[destPileIndex], baseCard];
        if (srcLocation === 'tableau') nextScore += 10;
        if (srcLocation === 'waste') nextScore += 15;
        
        // Check win condition
        const totalFoundations = newFoundations.reduce((acc, f) => acc + f.length, 0);
        if (totalFoundations === 52) {
          setTimeout(() => setGameState('win'), 500); // slight delay to see the last card land
        }
      } else if (destLocation === 'tableau') {
        newTableau[destPileIndex] = [...newTableau[destPileIndex], ...movingCards];
        if (srcLocation === 'waste') nextScore += 5;
        if (srcLocation === 'foundation') nextScore -= 15;
      }

      setMoves(m => m + 1);

      if (srcLocation === 'waste') {
        const newWaste = [...waste];
        newWaste.pop();
        setWaste(newWaste);
        setWasteDrawCount(newWaste.length === 0 ? 0 : Math.max(1, wasteDrawCount - 1));
      } else if (srcLocation === 'tableau') {
        newTableau[srcPileIndex] = newTableau[srcPileIndex].slice(0, srcCardIndex);
        if (newTableau[srcPileIndex].length > 0 && !newTableau[srcPileIndex][newTableau[srcPileIndex].length - 1].isFaceUp) {
          newTableau[srcPileIndex][newTableau[srcPileIndex].length - 1].isFaceUp = true;
          nextScore += 5;
        }
      } else if (srcLocation === 'foundation') {
        newFoundations[srcPileIndex].pop();
      }

      setScore(Math.max(0, nextScore));
      setTableau(newTableau);
      setFoundations(newFoundations);
      // Check win condition
      const totalFoundations = newFoundations.reduce((acc, f) => acc + f.length, 0);
      if (totalFoundations === 52) {
        setTimeout(() => setGameState('win'), 500); // slight delay to see the last card land
      } else {
        setTimeout(() => {
          if (checkGameOverCondition(stock, waste, newFoundations, newTableau)) {
            setGameState('gameover');
          }
        }, 500);
      }
      return true;
    }
    return false;
  };

  const autoMoveToFoundation = (srcLocation, srcPileIndex, srcCardIndex) => {
    let baseCard = null;
    let isMultiple = false;
    if (srcLocation === 'waste' && waste.length > 0) baseCard = waste[waste.length - 1];
    else if (srcLocation === 'tableau' && tableau[srcPileIndex].length > 0) {
      baseCard = tableau[srcPileIndex][srcCardIndex];
      isMultiple = tableau[srcPileIndex].length - 1 > srcCardIndex;
    }
    
    if (!baseCard || isMultiple) return false;

    for (let f = 0; f < 4; f++) {
      if (checkValidMove(baseCard, 'foundation', f, false, foundations, tableau)) {
        setCascadeQueue([{ srcLocation, srcPileIndex, srcCardIndex, destLocation: 'foundation', destPileIndex: f, card: baseCard }]);
        setIsCascading(true);
        return true;
      }
    }
    return false;
  };

  globalAttemptMove = attemptMove;
  globalAutoMove = autoMoveToFoundation;

  useEffect(() => {
    if (!isCascading || flyingData) return;

    let nextMove = null;
    if (cascadeQueue.length > 0) {
      nextMove = cascadeQueue[0];
      setCascadeQueue(prev => prev.slice(1));
    } else {
      for (let t = 0; t < 7; t++) {
          const pile = tableau[t];
          if (pile.length > 0) {
            const c = pile[pile.length - 1];
            if (c.isFaceUp) {
              for (let f = 0; f < 4; f++) {
                if (checkValidMove(c, 'foundation', f, false, foundations, tableau)) {
                  nextMove = { srcLocation: 'tableau', srcPileIndex: t, srcCardIndex: pile.length - 1, destLocation: 'foundation', destPileIndex: f, card: c };
                  break;
                }
              }
            }
          }
          if (nextMove) break;
        }
    }

    if (nextMove) {
      const destZone = dropZones[`foundation-${nextMove.destPileIndex}`];
      let startX = 0, startY = 0;
      if (nextMove.srcLocation === 'waste') {
        const wasteZone = dropZones[`waste-0`];
        startX = (wasteZone?.layout?.x || 0) + (wasteZone?.layout?.width || 0) - cardWidth;
        startY = wasteZone?.layout?.y || 0;
      } else if (nextMove.srcLocation === 'tableau') {
        const tZone = dropZones[`tableau-${nextMove.srcPileIndex}`];
        startX = tZone?.layout?.x || 0;
        startY = tZone?.layout?.y || 0;
        const pile = tableau[nextMove.srcPileIndex];
        let currentTop = 0;
        for (let i = 0; i < nextMove.srcCardIndex; i++) {
          currentTop += pile[i].isFaceUp ? 22 : 11;
        }
        startY += currentTop;
      }
      
      const endX = destZone?.layout?.x || 0;
      const endY = destZone?.layout?.y || 0;
      
      flyAnim.setValue({ x: startX, y: startY });
      setFlyingData(nextMove);
      
      Animated.timing(flyAnim, {
        toValue: { x: endX, y: endY },
        duration: 250,
        useNativeDriver: false
      }).start(() => {
        attemptMove(nextMove.srcLocation, nextMove.srcPileIndex, nextMove.srcCardIndex, nextMove.destLocation, nextMove.destPileIndex);
        setFlyingData(null);
      });
    } else {
      setIsCascading(false);
    }
  }, [isCascading, flyingData, tableau, foundations, waste]);

  const handleHint = () => {
    let possibleMoves = [];

    if (waste.length > 0) {
      const card = waste[waste.length - 1];
      for (let f = 0; f < 4; f++) {
        if (checkValidMove(card, 'foundation', f, false, foundations, tableau)) {
          possibleMoves.push({ srcId: card.id, destType: 'foundation', destIndex: f, priority: 3 });
        }
      }
      for (let t = 0; t < 7; t++) {
        if (checkValidMove(card, 'tableau', t, false, foundations, tableau)) {
          possibleMoves.push({ srcId: card.id, destType: 'tableau', destIndex: t, priority: 2 });
        }
      }
    }

    for (let tSrc = 0; tSrc < 7; tSrc++) {
      const pile = tableau[tSrc];
      for (let cSrc = 0; cSrc < pile.length; cSrc++) {
        if (!pile[cSrc].isFaceUp) continue;
        
        const card = pile[cSrc];
        const isMultiple = cSrc < pile.length - 1;

        if (!isMultiple) {
          for (let f = 0; f < 4; f++) {
            if (checkValidMove(card, 'foundation', f, false, foundations, tableau)) {
              possibleMoves.push({ srcId: card.id, destType: 'foundation', destIndex: f, priority: 4 });
            }
          }
        }

        for (let tDest = 0; tDest < 7; tDest++) {
          if (tSrc === tDest) continue;
          
          if (checkValidMove(card, 'tableau', tDest, isMultiple, foundations, tableau)) {
            let priority = 0;
            if (cSrc > 0 && !pile[cSrc - 1].isFaceUp) {
              priority = 3; 
            } else if (cSrc === 0 && card.value === 'K' && tableau[tDest].length === 0) {
              priority = 0; 
            } else if (cSrc === 0) {
              priority = 1; 
            } else {
              priority = 0; 
            }

            if (priority > 0) {
              possibleMoves.push({ srcId: card.id, destType: 'tableau', destIndex: tDest, priority });
            }
          }
        }
      }
    }

    possibleMoves.sort((a, b) => b.priority - a.priority);

    if (possibleMoves.length > 0) {
      setHinting(possibleMoves[0]);
      setTimeout(() => setHinting(null), 1500);
    } else if (stock.length > 0 || waste.length > 0) {
      setHinting({ destType: 'stock', destIndex: 0 });
      setTimeout(() => setHinting(null), 1500);
    } else {
      setGameState('gameover');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (gameState === 'menu') {
    const hasGame = stock.length > 0 || waste.length > 0 || tableau.some(p => p.length > 0);
    return (
      <SafeAreaView style={styles.menuContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.menuTitle}>Klondike Solitaire</Text>
        <Text style={styles.menuSubtitle}>by John Sacco</Text>
        
        {hasGame && (
          <TouchableOpacity style={styles.menuButton} onPress={() => setGameState('playing')}>
            <Text style={styles.menuButtonText}>Resume Game</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.menuButton} onPress={() => initializeGame(drawCount, difficulty)}>
          <Text style={styles.menuButtonText}>New Game</Text>
        </TouchableOpacity>
        
        <View style={styles.settingsBox}>
          <Text style={styles.settingsTitle}>Draw Mode</Text>
          <View style={styles.settingRow}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDrawCount(1)}>
              <View style={[styles.checkbox, drawCount === 1 && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Draw 1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDrawCount(3)}>
              <View style={[styles.checkbox, drawCount === 3 && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Draw 3</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.settingsTitle, {marginTop: 20}]}>Difficulty</Text>
          <View style={styles.settingRow}>
            {['easy', 'normal', 'hard'].map(diff => (
              <TouchableOpacity key={diff} style={styles.checkboxRow} onPress={() => setDifficulty(diff)}>
                <View style={[styles.checkbox, difficulty === diff && styles.checkboxChecked]} />
                <Text style={styles.checkboxLabel}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={[styles.settingsTitle, {marginTop: 20}]}>Card Design</Text>
          <View style={styles.settingRow}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setCardBackColor('blue')}>
              <View style={[styles.checkbox, cardBackColor === 'blue' && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Blue Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setCardBackColor('red')}>
              <View style={[styles.checkbox, cardBackColor === 'red' && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Red Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (gameState === 'animating_win') {
    return <WinAnimation foundations={foundations} onComplete={() => setGameState('won')} />;
  }

  if (gameState === 'won' || gameState === 'gameover') {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.menuTitle}>{gameState === 'won' ? 'You Won!' : 'No Moves Left!'}</Text>
        <Text style={styles.winStats}>Score: {score}</Text>
        <Text style={styles.winStats}>Time: {formatTime(time)}</Text>
        <Text style={styles.winStats}>Moves: {moves}</Text>
        <TouchableOpacity style={[styles.menuButton, {marginTop: 40}]} onPress={() => initializeGame(drawCount, difficulty)}>
          <Text style={styles.menuButtonText}>Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuButton, {marginTop: 10}]} onPress={() => setGameState('menu')}>
          <Text style={styles.menuButtonText}>Main Menu</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
      {gameState === 'win' && <WinScreen onNextGame={() => setGameState('menu')} />}
      <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <Text style={styles.headerText}>Score: {score}</Text>
          <Text style={styles.headerText}>Time: {formatTime(time)}</Text>
          <Text style={styles.headerText}>Moves: {moves}</Text>
        </View>
      
      <View style={[styles.topRow, { zIndex: activeDragLoc && !activeDragLoc.startsWith('tableau') ? 999 : 10 }]}>
        <View style={styles.foundationsContainer}>
          {foundations.map((f, index) => (
            <DroppablePile 
              key={`f-${index}`} 
              type="foundation" 
              index={index} 
              cards={f} 
              hinting={hinting} 
              activeDragLoc={activeDragLoc} 
            />
          ))}
        </View>

             <View style={styles.stockWasteContainer}>
          <View 
            style={[styles.wasteContainer, { zIndex: activeDragLoc?.startsWith('waste-0') ? 999 : 1 }]}
            onLayout={(e) => {
              e.target.measure((x, y, width, height, pageX, pageY) => {
                registerDropZone('waste', 0, { x: pageX, y: pageY, width, height });
              });
            }}
          >
            {(() => {
              const startIdx = Math.max(0, waste.length - drawCount);
              const visibleWaste = waste.slice(startIdx);
              return visibleWaste.map((card, i) => {
                const actualIndex = startIdx + i;
                if (flyingData && flyingData.srcLocation === 'waste' && flyingData.srcCardIndex === actualIndex) {
                  return null;
                }
                return (
                  <View key={card.id} style={[{position: 'absolute', right: (visibleWaste.length - 1 - i) * (cardWidth * 0.35), zIndex: i}]}>
                    <DraggableCard card={card} location="waste" pileIndex={0} cardIndex={actualIndex} hinting={hinting} />
                  </View>
                );
              });
            })()}
          </View>
          <TouchableOpacity onPress={handleStockTap} activeOpacity={0.8} style={styles.stockContainer}>
            {stock.length > 0 ? (
              <View style={[styles.card, { padding: 0 }, hinting?.destType === 'stock' && styles.hintGlowDest]}>
                <Image 
                  source={cardBackColor === 'red' ? require('./assets/card_back_red.jpg') : require('./assets/card_back_blue.jpg')} 
                  style={{ width: '115%', height: '115%', position: 'absolute', top: '-7.5%', left: '-7.5%', borderRadius: 6 }} 
                  resizeMode="cover" 
                />
              </View>
            ) : (
              <View style={[styles.cardSlot, hinting?.destType === 'stock' && styles.hintGlowDest]}>
                <Text style={styles.recycleIcon}>↻</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tableauContainer, { zIndex: activeDragLoc?.startsWith('tableau') ? 999 : 1 }]}>
        {tableau.map((pile, pileIndex) => (
          <DroppablePile 
            key={`t-${pileIndex}`} 
            type="tableau" 
            index={pileIndex} 
            cards={pile} 
            isTableau={true} 
            hinting={hinting} 
            activeDragLoc={activeDragLoc} 
            flyingData={flyingData}
          />
        ))}
      </View>
      
      <View style={[styles.actionBar, { backgroundColor: 'transparent', position: 'absolute', bottom: 10, left: 0, right: 0, paddingHorizontal: 16 }]} pointerEvents="box-none">
        {windowWidth >= 768 ? (
          [0, 1, 2, 3, 4, 5, 6].map(i => {
            let actionBtn = null;
            if (i === 0) actionBtn = (
              <TouchableOpacity style={styles.actionButton} onPress={() => setGameState('menu')}>
                <Text style={styles.actionIcon}>☰</Text>
                <Text style={styles.actionText}>Menu</Text>
              </TouchableOpacity>
            );
            if (i === 2) actionBtn = (
              <TouchableOpacity style={styles.actionButton} onPress={handleHint}>
                <Text style={styles.actionIcon}>💡</Text>
                <Text style={styles.actionText}>Hint</Text>
              </TouchableOpacity>
            );
            if (i === 3) actionBtn = (
              <TouchableOpacity style={styles.actionButton} onPress={() => {
                Alert.alert('New Game', 'Are you sure you want to start a new game?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Yes', onPress: () => initializeGame(drawCount, difficulty) }
                ]);
              }}>
                <Text style={styles.actionIcon}>✦</Text>
                <Text style={styles.actionText}>New</Text>
              </TouchableOpacity>
            );
            if (i === 5) actionBtn = (
              <TouchableOpacity style={[styles.actionButton, history.length === 0 && {opacity: 0.5}]} onPress={handleUndo} disabled={history.length === 0}>
                <Text style={styles.actionIcon}>↩</Text>
                <Text style={styles.actionText}>Undo</Text>
              </TouchableOpacity>
            );

            return (
              <View key={`gap-${i}`} style={{ width: cardWidth }} pointerEvents="box-none">
                {actionBtn && (
                  <View style={{ position: 'absolute', left: cardWidth, width: gapSize, alignItems: 'center', bottom: 0 }} pointerEvents="box-none">
                    {actionBtn}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', flex: 1 }} pointerEvents="box-none">
            <TouchableOpacity style={styles.actionButton} onPress={() => setGameState('menu')}>
              <Text style={styles.actionIcon}>☰</Text>
              <Text style={styles.actionText}>Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleHint}>
              <Text style={styles.actionIcon}>💡</Text>
              <Text style={styles.actionText}>Hint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => {
              Alert.alert('New Game', 'Are you sure you want to start a new game?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Yes', onPress: () => initializeGame(drawCount, difficulty) }
              ]);
            }}>
              <Text style={styles.actionIcon}>✦</Text>
              <Text style={styles.actionText}>New</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, history.length === 0 && {opacity: 0.5}]} onPress={handleUndo} disabled={history.length === 0}>
              <Text style={styles.actionIcon}>↩</Text>
              <Text style={styles.actionText}>Undo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </SafeAreaView>
      {flyingData && (
        <Animated.View style={[
          { position: 'absolute', zIndex: 9999, width: cardWidth, height: cardHeight },
          flyAnim.getLayout()
        ]}>
          <CardDisplay card={flyingData.card} />
        </Animated.View>
      )}
    </View>
  );
}

const DroppablePile = ({ type, index, cards, isTableau, hinting, activeDragLoc, flyingData }) => {
  const handleLayout = (e) => {
    e.target.measure((x, y, width, height, pageX, pageY) => {
      registerDropZone(type, index, { x: pageX, y: pageY, width, height: isTableau ? Math.max(height, cardHeight * 3) : height });
    });
  };

  const isHintDest = hinting && hinting.destType === type && hinting.destIndex === index;
  const isDraggingHere = activeDragLoc && activeDragLoc.startsWith(`${type}-${index}`);
  
  let draggingCardIndex = -1;
  if (isDraggingHere) {
    draggingCardIndex = parseInt(activeDragLoc.split('-')[2]);
  }

  let currentTop = 0;

  return (
    <View 
      style={[isTableau ? styles.tableauColumn : styles.foundationPile, { zIndex: isDraggingHere ? 999 : 1 }]} 
      onLayout={handleLayout} 
      collapsable={false}
    >
      {cards.length === 0 && (
        <View style={[styles.cardSlot, isHintDest && styles.hintGlowDest]}>
          {type === 'foundation' && <Text style={{ fontSize: cardWidth * 0.5, color: 'rgba(255, 255, 255, 0.2)', fontWeight: 'bold' }}>A</Text>}
        </View>
      )}
      {cards.map((card, cardIndex) => {
        const topPos = currentTop;
        if (isTableau) {
          currentTop += card.isFaceUp ? cardHeight * 0.26 : cardHeight * 0.1;
        }

        // Hide cards that are visually grabbed by the DraggableCard above them
        if (isDraggingHere && cardIndex > draggingCardIndex) {
          return null;
        }

        // Hide flying card
        if (flyingData && flyingData.srcLocation === type && flyingData.srcPileIndex === index && flyingData.srcCardIndex === cardIndex) {
          return null; 
        }

        const isMovable = card.isFaceUp;
        return (
          <View key={card.id} style={isTableau ? [styles.tableauCardWrapper, { top: topPos }] : styles.foundationCardWrapper}>
            {isMovable ? (
              <DraggableCard 
                card={card} 
                location={type} 
                pileIndex={index} 
                cardIndex={cardIndex} 
                hinting={hinting}
                movingCards={isTableau ? cards.slice(cardIndex) : [card]}
                isTableau={isTableau}
              />
            ) : (
              <CardDisplay card={card} hinting={hinting?.srcId === card.id} />
            )}
          </View>
        );
      })}
    </View>
  );
};

const DraggableCard = ({ card, location, pileIndex, cardIndex, movingCards = [], isTableau, hinting }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const lastTap = useRef(0);

  const propsRef = useRef({ location, pileIndex, cardIndex });
  propsRef.current = { location, pileIndex, cardIndex };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        const { location: loc, pileIndex: pIdx, cardIndex: cIdx } = propsRef.current;
        setIsDragging(true);
        globalSetDraggingPile(`${loc}-${pIdx}-${cIdx}`);
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
        globalPlaySound();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
        const { location: loc, pileIndex: pIdx, cardIndex: cIdx } = propsRef.current;
        pan.flattenOffset();
        
        const now = Date.now();
        if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
          if (now - lastTap.current < 300) {
            if (globalAutoMove(loc, pIdx, cIdx)) {
              setIsDragging(false);
              globalSetDraggingPile(null);
              return; 
            }
          }
          lastTap.current = now;
        }

        let droppedOn = null;
        for (const key in dropZones) {
          const zone = dropZones[key];
          if (
            gesture.moveX >= zone.layout.x && gesture.moveX <= zone.layout.x + zone.layout.width &&
            gesture.moveY >= zone.layout.y && gesture.moveY <= zone.layout.y + zone.layout.height
          ) {
            droppedOn = zone;
            break;
          }
        }

        let moved = false;
        if (droppedOn) {
          moved = globalAttemptMove(loc, pIdx, cIdx, droppedOn.type, droppedOn.index);
        }

        if (!moved) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start((status) => {
            if (status.finished) {
              setIsDragging(false);
              globalSetDraggingPile(null);
            }
          });
        } else {
          setIsDragging(false);
          globalSetDraggingPile(null);
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start((status) => {
          if (status.finished) {
            setIsDragging(false);
            globalSetDraggingPile(null);
          }
        });
      }
    })
  ).current;

  const renderedCards = isDragging && movingCards.length > 0 ? movingCards : [card];

  return (
    <Animated.View {...panResponder.panHandlers} style={[pan.getLayout(), { zIndex: isDragging ? 999 : 1 }]}>
      {renderedCards.map((c, i) => (
        <View key={c.id} style={i > 0 ? { position: 'absolute', top: i * (cardHeight * 0.26), left: 0, right: 0 } : {}}>
          <CardDisplay card={c} isDragging={isDragging && i===0} hinting={hinting?.srcId === c.id} />
        </View>
      ))}
    </Animated.View>
  );
};

const FACE_IMAGES = {
  'K': require('./assets/face_card_king.jpg'),
  'Q': require('./assets/face_card_queen.jpg'),
  'J': require('./assets/face_card_jack.jpg')
};

const CardDisplay = ({ card, isDragging, hinting }) => {
  if (!card) return null;
  if (!card.isFaceUp) {
    return (
      <View style={[styles.card, { padding: 0 }]}>
        <Image 
          source={globalCardBackColor === 'red' ? require('./assets/card_back_red.jpg') : require('./assets/card_back_blue.jpg')} 
          style={{ width: '115%', height: '115%', position: 'absolute', top: '-7.5%', left: '-7.5%', borderRadius: 6 }} 
          resizeMode="cover" 
        />
      </View>
    );
  }
  const color = isRed(card.suit) ? '#ef4444' : '#111827';
  return (
    <View style={[styles.card, isDragging && styles.cardDragging, hinting && styles.hintGlow]}>
      <Text style={[styles.cardValueTop, { color }]}>{card.value}{card.suit}</Text>
      {FACE_IMAGES[card.value] ? (
        <View style={[styles.cardSuitContainer, { overflow: 'hidden', marginHorizontal: -4, marginBottom: -4, alignItems: 'center' }]}>
          <Image 
            source={FACE_IMAGES[card.value]} 
            style={{ width: '150%', height: '150%', position: 'absolute', top: 0, borderRadius: 2 }}
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={[styles.cardSuitContainer, { marginBottom: -4 }]}>
          <Text style={[styles.cardSuitCenter, { color, transform: [{ translateY: -4 }] }]}>{card.suit}</Text>
        </View>
      )}
    </View>
  );
};

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;
const maxCardHeight = windowHeight * 0.18; // Ensure at least ~5.5 cards can stack vertically
const maxCardWidth = maxCardHeight / 1.4;
const cardWidth = Math.min((windowWidth - 32 - 30) / 7, maxCardWidth); 
const cardHeight = cardWidth * 1.4;
const gapSize = (windowWidth - 32 - 7 * cardWidth) / 6;

const WinAnimation = ({ foundations, onComplete }) => {
  const [activeCards, setActiveCards] = useState([]);
  const speedRef = useRef(1);
  const engineRef = useRef(null);
  const allCards = useRef([]);
  const startTime = useRef(Date.now());
  
  useEffect(() => {
    let cards = [];
    for (let f = 0; f < 4; f++) {
      for (let c = 0; c < foundations[f].length; c++) {
        cards.push({
          card: foundations[f][c],
          x: 16 + f * (cardWidth + 8),
          y: 60,
          vx: (Math.random() - 0.5) * 15,
          vy: -Math.random() * 15 - 5,
          active: false
        });
      }
    }
    allCards.current = cards.reverse(); 
    
    let lastTime = Date.now();
    let spawnTimer = 0;

    const loop = () => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;
      
      let speed = speedRef.current;
      if (speed > 1) {
        if (now - startTime.current < 4000) {
          speed = 1;
        } else {
          speed = 2.5;
        }
      }
      
      spawnTimer += dt * speed;
      if (spawnTimer > 250 && allCards.current.length > 0) {
        spawnTimer = 0;
        const next = allCards.current.shift();
        if (next) {
          next.active = true;
          setActiveCards(prev => [...prev, next]);
        }
      }
      
      setActiveCards(prev => {
        let updated = false;
        const nextState = prev.map(c => {
          if (!c.active) return c;
          updated = true;
          c.vy += 0.8 * speed; 
          c.x += c.vx * speed;
          c.y += c.vy * speed;
          
          if (c.y > windowHeight - cardHeight) {
            c.y = windowHeight - cardHeight;
            c.vy = -Math.abs(c.vy) * 0.75;
          }
          return c;
        });
        
        const filtered = nextState.filter(c => c.x > -cardWidth && c.x < windowWidth);
        
        if (filtered.length === 0 && allCards.current.length === 0) {
          onComplete();
        } else {
          engineRef.current = requestAnimationFrame(loop);
        }
        
        return updated ? [...filtered] : prev;
      });
    };
    
    engineRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(engineRef.current);
  }, []);

  return (
    <TouchableWithoutFeedback onPressIn={() => speedRef.current = 5} onPressOut={() => speedRef.current = 1}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0f5132', zIndex: 1000 }]}>
        {activeCards.map((c, i) => (
          <View key={`${c.card.id}-${i}`} style={{ position: 'absolute', left: c.x, top: c.y }}>
            <CardDisplay card={c.card} />
          </View>
        ))}
        <Text style={{ position: 'absolute', bottom: 50, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 18, fontWeight: 'bold' }}>Hold to speed up</Text>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  menuContainer: { flex: 1, backgroundColor: '#0f5132', alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  menuSubtitle: { fontSize: 18, color: '#fbbf24', fontStyle: 'italic', marginBottom: 40 },
  menuButton: { backgroundColor: '#fbbf24', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, marginVertical: 10, width: 200, alignItems: 'center' },
  menuButtonText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  winStats: { fontSize: 20, color: '#fff', marginVertical: 5 },
  settingsBox: { marginTop: 40, padding: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, width: '90%', maxWidth: 400 },
  settingsTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  settingGroup: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, marginHorizontal: 5 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#fff', borderRadius: 10, marginRight: 8 },
  checkboxChecked: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  checkboxLabel: { color: '#fff', fontSize: 14 },
  container: { flex: 1, backgroundColor: '#0f5132' },
  header: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  headerText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, marginBottom: 24, zIndex: 10 },
  foundationsContainer: { flexDirection: 'row', gap: 8 },
  stockWasteContainer: { flexDirection: 'row', gap: 8 },
  foundationPile: { width: cardWidth, height: cardHeight },
  foundationCardWrapper: { position: 'absolute' },
  wasteContainer: { width: cardWidth + 40, height: cardHeight },
  stockContainer: { width: cardWidth, height: cardHeight },
  recycleIcon: { fontSize: 24, color: 'rgba(255,255,255,0.3)' },
  tableauContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  tableauColumn: { width: cardWidth, minHeight: cardHeight },
  tableauCardWrapper: { position: 'absolute', left: 0, right: 0 },
  cardSlot: { width: cardWidth, height: cardHeight, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  card: { width: cardWidth, height: cardHeight, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#ccc', padding: 4, overflow: 'hidden' },
  cardBack: { backgroundColor: '#1d4ed8', borderColor: '#fff', borderWidth: 2, padding: 3 },
  cardBackPattern: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 2 },
  cardDragging: { borderColor: '#fbbf24', borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  cardValueTop: { fontSize: Math.max(16, cardWidth * 0.32), fontWeight: 'bold' },
  cardSuitContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardSuitCenter: { fontSize: Math.max(42, cardWidth * 0.84), textAlign: 'center', transform: [{ translateY: -4 }] },
  hintGlow: { borderColor: '#ffd700', borderWidth: 3, shadowColor: '#ffd700', shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  hintGlowDest: { borderColor: '#ffd700', borderWidth: 3, backgroundColor: 'rgba(255, 215, 0, 0.3)' },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 1000 },
  actionButton: { padding: 6, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, minWidth: 60 },
  actionIcon: { fontSize: 20, color: '#fff', marginBottom: 2, height: 24, lineHeight: 24, textAlign: 'center' },
  actionText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});
