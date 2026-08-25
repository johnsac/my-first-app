import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, PanResponder, Animated } from 'react-native';

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

const shuffle = (deck, difficulty) => {
  let d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }

  if (difficulty === 'easy') {
    const aces = d.filter(c => c.value === 'A');
    d = d.filter(c => c.value !== 'A');
    d.push(...aces);
  } else if (difficulty === 'hard') {
    const aces = d.filter(c => c.value === 'A');
    d = d.filter(c => c.value !== 'A');
    d.unshift(...aces);
  }
  return d;
};

const dropZones = {};
let globalAttemptMove = () => false;
let globalAutoMove = () => false;
let globalSetDraggingPile = () => {};
let globalPlaySound = () => {};

const registerDropZone = (type, index, layout) => {
  dropZones[`${type}-${index}`] = { type, index, layout };
};

export default function App() {
  const [gameState, setGameState] = useState('menu'); 
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
    const deck = shuffle(createDeck(), selectedDifficulty);
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
    if (isWin) setGameState('won');
  };

  const checkGameOverCondition = (currentStock, currentWaste, currentFoundations, currentTableau) => {
    if (currentStock.length > 0 || currentWaste.length > 0) return false;
    if (currentWaste.length > 0) {
      const card = currentWaste[currentWaste.length - 1];
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
    
    if (stock.length === 0) {
      if (waste.length === 0) return;
      const recycled = [...waste].reverse().map(c => ({...c, isFaceUp: false}));
      setStock(recycled);
      setWaste([]);
      setWasteDrawCount(0);
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
      setWasteDrawCount(limit);
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
      if (destLocation === 'foundation') checkWinCondition(newFoundations);
      
      setTimeout(() => {
        if (checkGameOverCondition(stock, waste, newFoundations, newTableau)) {
          setGameState('gameover');
        }
      }, 500);
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
        return attemptMove(srcLocation, srcPileIndex, srcCardIndex, 'foundation', f);
      }
    }
    return false;
  };

  globalAttemptMove = attemptMove;
  globalAutoMove = autoMoveToFoundation;

  const handleHint = () => {
    let possibleMove = null;

    if (waste.length > 0) {
      const card = waste[waste.length - 1];
      for (let f = 0; f < 4; f++) {
        if (checkValidMove(card, 'foundation', f, false, foundations, tableau)) {
          possibleMove = { srcId: card.id, destType: 'foundation', destIndex: f };
          break;
        }
      }
      if (!possibleMove) {
        for (let t = 0; t < 7; t++) {
          if (checkValidMove(card, 'tableau', t, false, foundations, tableau)) {
            possibleMove = { srcId: card.id, destType: 'tableau', destIndex: t };
            break;
          }
        }
      }
    }

    if (!possibleMove) {
      for (let tSrc = 0; tSrc < 7; tSrc++) {
        const pile = tableau[tSrc];
        for (let cSrc = 0; cSrc < pile.length; cSrc++) {
          if (!pile[cSrc].isFaceUp) continue;
          
          const card = pile[cSrc];
          const isMultiple = cSrc < pile.length - 1;

          if (!isMultiple) {
            for (let f = 0; f < 4; f++) {
              if (checkValidMove(card, 'foundation', f, false, foundations, tableau)) {
                possibleMove = { srcId: card.id, destType: 'foundation', destIndex: f };
                break;
              }
            }
          }
          if (possibleMove) break;

          for (let tDest = 0; tDest < 7; tDest++) {
            if (tSrc === tDest) continue;
            if (card.value === 'K' && cSrc === 0 && tableau[tDest].length === 0) continue;
            if (checkValidMove(card, 'tableau', tDest, isMultiple, foundations, tableau)) {
              possibleMove = { srcId: card.id, destType: 'tableau', destIndex: tDest };
              break;
            }
          }
          if (possibleMove) break;
        }
        if (possibleMove) break;
      }
    }

    if (possibleMove) {
      setHinting(possibleMove);
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
        
        {hasGame && (
          <TouchableOpacity style={styles.menuButton} onPress={() => setGameState('playing')}>
            <Text style={styles.menuButtonText}>Resume Game</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.menuButton} onPress={() => initializeGame(drawCount, difficulty)}>
          <Text style={styles.menuButtonText}>New Game</Text>
        </TouchableOpacity>
        
        <View style={styles.settingsBox}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <View style={styles.settingGroup}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDrawCount(drawCount === 1 ? 3 : 1)}>
              <View style={[styles.checkbox, drawCount === 1 && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Draw 1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setDrawCount(drawCount === 3 ? 1 : 3)}>
              <View style={[styles.checkbox, drawCount === 3 && styles.checkboxChecked]} />
              <Text style={styles.checkboxLabel}>Draw 3</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.settingsTitle, {marginTop: 20}]}>Difficulty</Text>
          <View style={styles.settingColumn}>
            {['easy', 'normal', 'hard'].map(diff => (
              <TouchableOpacity key={diff} style={styles.checkboxRow} onPress={() => setDifficulty(diff)}>
                <View style={[styles.checkbox, difficulty === diff && styles.checkboxChecked]} />
                <Text style={styles.checkboxLabel}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerText}>Score: {score}</Text>
        <Text style={styles.headerText}>Time: {formatTime(time)}</Text>
        <Text style={styles.headerText}>Moves: {moves}</Text>
      </View>
      
      <View style={styles.topRow}>
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
          <View style={[styles.wasteContainer, { zIndex: activeDragLoc?.startsWith('waste-0') ? 999 : 1 }]}>
            {(() => {
              const visibleCards = waste.slice(-Math.max(1, wasteDrawCount));
              const offset = 40 - (Math.max(0, visibleCards.length - 1) * 20);
              return visibleCards.map((card, i, arr) => (
                <View key={card.id} style={{ position: 'absolute', left: offset + i * 20 }}>
                  {i === arr.length - 1 ? (
                    <DraggableCard 
                      card={card} 
                      location="waste" 
                      pileIndex={0} 
                      cardIndex={waste.length - 1} 
                      hinting={hinting}
                    />
                  ) : (
                    <CardDisplay card={card} hinting={hinting?.srcId === card.id} />
                  )}
                </View>
              ));
            })()}
          </View>
          <TouchableOpacity onPress={handleStockTap} activeOpacity={0.8} style={styles.stockContainer}>
            {stock.length > 0 ? (
              <View style={[styles.card, styles.cardBack, hinting?.destType === 'stock' && styles.hintGlowDest]}>
                <View style={styles.cardBackPattern} />
              </View>
            ) : (
              <View style={[styles.cardSlot, hinting?.destType === 'stock' && styles.hintGlowDest]}>
                <Text style={styles.recycleIcon}>↻</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tableauContainer}>
        {tableau.map((pile, pileIndex) => (
          <DroppablePile 
            key={`t-${pileIndex}`} 
            type="tableau" 
            index={pileIndex} 
            cards={pile} 
            isTableau={true} 
            hinting={hinting} 
            activeDragLoc={activeDragLoc} 
          />
        ))}
      </View>
      
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

const DroppablePile = ({ type, index, cards, isTableau, hinting, activeDragLoc }) => {
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
      {cards.length === 0 && <View style={[styles.cardSlot, isHintDest && styles.hintGlowDest]} />}
      {cards.map((card, cardIndex) => {
        const topPos = currentTop;
        if (isTableau) {
          currentTop += card.isFaceUp ? 22 : 11;
        }

        // Hide cards that are visually grabbed by the DraggableCard above them
        if (isDraggingHere && cardIndex > draggingCardIndex) {
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        setIsDragging(true);
        globalSetDraggingPile(`${location}-${pileIndex}-${cardIndex}`);
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
        globalPlaySound();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
        setIsDragging(false);
        globalSetDraggingPile(null);
        pan.flattenOffset();
        
        const now = Date.now();
        if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
          if (now - lastTap.current < 300) {
            if (globalAutoMove(location, pileIndex, cardIndex)) {
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
          <CardDisplay card={c} isDragging={isDragging && i===0} hinting={hinting?.srcId === c.id} />
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
  settingsBox: { marginTop: 40, padding: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, width: 250 },
  settingsTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  settingGroup: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  settingColumn: { flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 20 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#fff', borderRadius: 12, marginRight: 10 },
  checkboxChecked: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  checkboxLabel: { color: '#fff', fontSize: 16, marginRight: 10 },
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
  card: { width: cardWidth, height: cardHeight, backgroundColor: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#ccc', padding: 4 },
  cardBack: { backgroundColor: '#1d4ed8', borderColor: '#fff', borderWidth: 2, padding: 3 },
  cardBackPattern: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 2 },
  cardDragging: { borderColor: '#fbbf24', borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  cardValueTop: { fontSize: 14, fontWeight: 'bold' },
  cardSuitCenter: { fontSize: 24, textAlign: 'center', marginTop: -4 },
  hintGlow: { borderColor: '#0ea5e9', borderWidth: 3, shadowColor: '#0ea5e9', shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  hintGlowDest: { borderColor: '#0ea5e9', borderWidth: 3, backgroundColor: 'rgba(14, 165, 233, 0.3)' },
  actionBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: 'auto' },
  actionButton: { padding: 10 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
