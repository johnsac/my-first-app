import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, Alert, PanResponder, Animated } from 'react-native';

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

const shuffle = (deck) => {
  let d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};

// Global reference to drop zones and move handler for PanResponder access without deep prop drilling
const dropZones = {};
let globalAttemptMove = () => false;

const registerDropZone = (type, index, layout) => {
  dropZones[`${type}-${index}`] = { type, index, layout };
};

export default function App() {
  const [gameState, setGameState] = useState('menu'); // menu, playing, won
  const [drawCount, setDrawCount] = useState(1);
  
  const [stock, setStock] = useState([]);
  const [waste, setWaste] = useState([]);
  const [foundations, setFoundations] = useState([[], [], [], []]);
  const [tableau, setTableau] = useState([[], [], [], [], [], [], []]);
  
  const [time, setTime] = useState(0);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  
  const [history, setHistory] = useState([]);
  const [hinting, setHinting] = useState(false);

  // Timer
  useEffect(() => {
    let interval = null;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setTime(t => t + 1);
      }, 1000);
    } else if (gameState !== 'playing') {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const saveHistory = (st = stock, w = waste, f = foundations, t = tableau, sc = score, m = moves) => {
    const snap = {
      stock: JSON.stringify(st),
      waste: JSON.stringify(w),
      foundations: JSON.stringify(f),
      tableau: JSON.stringify(t),
      score: sc,
      moves: m
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
    setHistory(history.slice(0, -1));
  };

  const initializeGame = (selectedDrawCount = 1) => {
    setDrawCount(selectedDrawCount);
    const deck = shuffle(createDeck());
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
    setFoundations([[], [], [], []]);
    setTime(0);
    setMoves(0);
    setScore(0);
    setHistory([]);
    setGameState('playing');
  };

  const checkWinCondition = (newFoundations) => {
    const isWin = newFoundations.every(f => f.length === 13);
    if (isWin) {
      setGameState('won');
    }
  };

  const handleStockTap = () => {
    saveHistory(stock, waste, foundations, tableau, score, moves);
    setMoves(m => m + 1);
    
    if (stock.length === 0) {
      const recycled = [...waste].reverse().map(c => ({...c, isFaceUp: false}));
      setStock(recycled);
      setWaste([]);
      setScore(s => Math.max(0, s - 100)); 
    } else {
      const newStock = [...stock];
      const newWaste = [...waste];
      const limit = Math.min(drawCount, newStock.length);
      
      for(let i=0; i<limit; i++) {
        const card = newStock.pop();
        card.isFaceUp = true;
        newWaste.push(card);
      }
      
      setStock(newStock);
      setWaste(newWaste);
    }
  };

  const attemptMove = (srcLocation, srcPileIndex, srcCardIndex, destLocation, destPileIndex) => {
    if (srcLocation === destLocation && srcPileIndex === destPileIndex) return false;

    let movingCards = [];
    if (srcLocation === 'waste') {
      movingCards = [waste[waste.length - 1]];
    } else if (srcLocation === 'tableau') {
      movingCards = tableau[srcPileIndex].slice(srcCardIndex);
    } else if (srcLocation === 'foundation') {
      movingCards = [foundations[srcPileIndex][foundations[srcPileIndex].length - 1]];
    }

    if (!movingCards || movingCards.length === 0 || !movingCards[0]) return false;
    const baseCard = movingCards[0];

    let isValidMove = false;
    let newFoundations = [...foundations];
    let newTableau = [...tableau];
    let scoreChange = 0;

    if (destLocation === 'foundation') {
      if (movingCards.length > 1) return false;
      const targetPile = foundations[destPileIndex];
      if (targetPile.length === 0) {
        isValidMove = baseCard.value === 'A';
      } else {
        const topCard = targetPile[targetPile.length - 1];
        isValidMove = baseCard.suit === topCard.suit && getValueRanking(baseCard.value) === getValueRanking(topCard.value) + 1;
      }
      
      if (isValidMove) {
        newFoundations[destPileIndex] = [...newFoundations[destPileIndex], baseCard];
        if (srcLocation === 'tableau') scoreChange = 10;
        if (srcLocation === 'waste') scoreChange = 15;
      }
    } else if (destLocation === 'tableau') {
      const targetPile = tableau[destPileIndex];
      if (targetPile.length === 0) {
        isValidMove = baseCard.value === 'K';
      } else {
        const topCard = targetPile[targetPile.length - 1];
        isValidMove = topCard.isFaceUp && isRed(baseCard.suit) !== isRed(topCard.suit) && getValueRanking(baseCard.value) === getValueRanking(topCard.value) - 1;
      }

      if (isValidMove) {
        newTableau[destPileIndex] = [...newTableau[destPileIndex], ...movingCards];
        if (srcLocation === 'waste') scoreChange = 5;
        if (srcLocation === 'foundation') scoreChange = -15;
      }
    }

    if (isValidMove) {
      saveHistory(stock, waste, foundations, tableau, score, moves);
      setMoves(m => m + 1);
      setScore(s => Math.max(0, s + scoreChange));

      if (srcLocation === 'waste') {
        const newWaste = [...waste];
        newWaste.pop();
        setWaste(newWaste);
      } else if (srcLocation === 'tableau') {
        newTableau[srcPileIndex] = newTableau[srcPileIndex].slice(0, srcCardIndex);
        if (newTableau[srcPileIndex].length > 0 && !newTableau[srcPileIndex][newTableau[srcPileIndex].length - 1].isFaceUp) {
          newTableau[srcPileIndex][newTableau[srcPileIndex].length - 1].isFaceUp = true;
          setScore(s => s + 5);
        }
      } else if (srcLocation === 'foundation') {
        newFoundations[srcPileIndex].pop();
      }

      setTableau(newTableau);
      setFoundations(newFoundations);
      if (destLocation === 'foundation') checkWinCondition(newFoundations);
      return true;
    }
    return false;
  };

  // Wire up global attempt move
  globalAttemptMove = attemptMove;

  const handleHint = () => {
    setHinting(true);
    setTimeout(() => setHinting(false), 800);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (gameState === 'menu') {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.menuTitle}>Klondike Solitaire</Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => initializeGame(1)}>
          <Text style={styles.menuButtonText}>Play Draw 1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => initializeGame(3)}>
          <Text style={styles.menuButtonText}>Play Draw 3</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (gameState === 'won') {
    return (
      <SafeAreaView style={styles.menuContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.menuTitle}>You Won!</Text>
        <Text style={styles.winStats}>Score: {score}</Text>
        <Text style={styles.winStats}>Time: {formatTime(time)}</Text>
        <Text style={styles.winStats}>Moves: {moves}</Text>
        <TouchableOpacity style={[styles.menuButton, {marginTop: 40}]} onPress={() => setGameState('menu')}>
          <Text style={styles.menuButtonText}>Main Menu</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Score: {score}</Text>
        <Text style={styles.headerText}>Time: {formatTime(time)}</Text>
        <Text style={styles.headerText}>Moves: {moves}</Text>
      </View>
      
      {/* Top row: Foundations (Left), Stock/Waste (Right) */}
      <View style={styles.topRow}>
        <View style={styles.foundationsContainer}>
          {foundations.map((f, index) => (
            <DroppablePile key={`f-${index}`} type="foundation" index={index} cards={f} hinting={hinting} />
          ))}
        </View>

        <View style={styles.stockWasteContainer}>
          <View style={styles.wasteContainer}>
            {waste.length > 0 && (
              <DraggableCard 
                card={waste[waste.length - 1]} 
                location="waste" 
                pileIndex={0} 
                cardIndex={waste.length - 1} 
                hinting={hinting}
              />
            )}
          </View>
          <TouchableOpacity onPress={handleStockTap} activeOpacity={0.8} style={styles.stockContainer}>
            {stock.length > 0 ? (
              <View style={[styles.card, styles.cardBack]}>
                <View style={styles.cardBackPattern} />
              </View>
            ) : (
              <View style={styles.cardSlot}>
                <Text style={styles.recycleIcon}>↻</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tableau */}
      <View style={styles.tableauContainer}>
        {tableau.map((pile, pileIndex) => (
          <DroppablePile key={`t-${pileIndex}`} type="tableau" index={pileIndex} cards={pile} isTableau={true} hinting={hinting} />
        ))}
      </View>
      
      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.actionButton, history.length === 0 && {opacity: 0.5}]} onPress={handleUndo} disabled={history.length === 0}>
          <Text style={styles.actionText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleHint}>
          <Text style={styles.actionText}>Hint</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setGameState('menu')}>
          <Text style={styles.actionText}>Menu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const DroppablePile = ({ type, index, cards, isTableau, hinting }) => {
  const handleLayout = (e) => {
    e.target.measure((x, y, width, height, pageX, pageY) => {
      registerDropZone(type, index, { x: pageX, y: pageY, width, height: isTableau ? Math.max(height, cardHeight * 3) : height });
    });
  };

  return (
    <View style={isTableau ? styles.tableauColumn : styles.foundationPile} onLayout={handleLayout} collapsable={false}>
      {cards.length === 0 && <View style={[styles.cardSlot, hinting && type==='foundation' && styles.hintGlow]} />}
      {cards.map((card, cardIndex) => {
        const isMovable = card.isFaceUp;
        return (
          <View key={card.id} style={isTableau ? [styles.tableauCardWrapper, { top: cardIndex * 22 }] : styles.foundationCardWrapper}>
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
              <CardDisplay card={card} />
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
        setIsDragging(false);
        pan.flattenOffset();
        
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
          moved = globalAttemptMove(location, pileIndex, cardIndex, droppedOn.type, droppedOn.index);
        }

        if (!moved) {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start();
        }
      }
    })
  ).current;

  const renderedCards = movingCards.length > 0 ? movingCards : [card];

  return (
    <Animated.View {...panResponder.panHandlers} style={[pan.getLayout(), { zIndex: isDragging ? 999 : 1 }]}>
      {renderedCards.map((c, i) => (
        <View key={c.id} style={i > 0 ? { position: 'absolute', top: i * 22, left: 0 } : {}}>
          <CardDisplay card={c} isDragging={isDragging && i===0} hinting={hinting} />
        </View>
      ))}
    </Animated.View>
  );
};

const CardDisplay = ({ card, isDragging, hinting }) => {
  if (!card) return null;
  if (!card.isFaceUp) {
    return (
      <View style={[styles.card, styles.cardBack]}>
        <View style={styles.cardBackPattern} />
      </View>
    );
  }
  const color = isRed(card.suit) ? '#ef4444' : '#111827';
  return (
    <View style={[styles.card, isDragging && styles.cardDragging, hinting && styles.hintGlow]}>
      <Text style={[styles.cardValueTop, { color }]}>{card.value}{card.suit}</Text>
      <Text style={[styles.cardSuitCenter, { color }]}>{card.suit}</Text>
    </View>
  );
};

const windowWidth = Dimensions.get('window').width;
const cardWidth = (windowWidth - 32 - 30) / 7; 
const cardHeight = cardWidth * 1.4;

const styles = StyleSheet.create({
  menuContainer: { flex: 1, backgroundColor: '#0f5132', alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 40 },
  menuButton: { backgroundColor: '#fbbf24', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, marginVertical: 10, width: 200, alignItems: 'center' },
  menuButtonText: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  winStats: { fontSize: 20, color: '#fff', marginVertical: 5 },
  container: { flex: 1, backgroundColor: '#0f5132' },
  header: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  headerText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, marginBottom: 24, zIndex: 10 },
  foundationsContainer: { flexDirection: 'row', gap: 8 },
  stockWasteContainer: { flexDirection: 'row', gap: 8 },
  foundationPile: { width: cardWidth, height: cardHeight },
  foundationCardWrapper: { position: 'absolute' },
  wasteContainer: { width: cardWidth, height: cardHeight },
  stockContainer: { width: cardWidth, height: cardHeight },
  recycleIcon: { fontSize: 24, color: 'rgba(255,255,255,0.3)' },
  tableauContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  tableauColumn: { width: cardWidth, minHeight: cardHeight },
  tableauCardWrapper: { position: 'absolute', left: 0, right: 0 },
  cardSlot: { width: cardWidth, height: cardHeight, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  card: { width: cardWidth, height: cardHeight, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#ccc', padding: 4 },
  cardBack: { backgroundColor: '#1d4ed8', borderColor: '#fff', borderWidth: 2, padding: 3 },
  cardBackPattern: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 2 },
  cardDragging: { borderColor: '#fbbf24', borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  cardValueTop: { fontSize: 14, fontWeight: 'bold' },
  cardSuitCenter: { fontSize: 24, textAlign: 'center', marginTop: -4 },
  hintGlow: { borderColor: '#fbbf24', borderWidth: 2, shadowColor: '#fbbf24', shadowOpacity: 1, shadowRadius: 10 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: 'auto' },
  actionButton: { padding: 10 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
