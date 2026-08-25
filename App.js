import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, StatusBar, Alert } from 'react-native';

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

export default function App() {
  const [stock, setStock] = useState([]);
  const [waste, setWaste] = useState([]);
  const [foundations, setFoundations] = useState([[], [], [], []]);
  const [tableau, setTableau] = useState([[], [], [], [], [], [], []]);
  
  // selectedCard: { location: 'waste' | 'tableau' | 'foundation', pileIndex: number, cardIndex: number }
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const deck = shuffle(createDeck());
    const newTableau = [[], [], [], [], [], [], []];
    
    // Deal tableau
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
    setSelectedCard(null);
  };

  const handleStockTap = () => {
    if (stock.length === 0) {
      // Recycle waste to stock
      const recycled = [...waste].reverse().map(c => ({...c, isFaceUp: false}));
      setStock(recycled);
      setWaste([]);
    } else {
      // Draw one card to waste
      const newStock = [...stock];
      const card = newStock.pop();
      card.isFaceUp = true;
      setStock(newStock);
      setWaste([...waste, card]);
    }
    setSelectedCard(null);
  };

  const checkWinCondition = (newFoundations) => {
    const isWin = newFoundations.every(f => f.length === 13);
    if (isWin) {
      Alert.alert("Congratulations!", "You won the game!", [
        { text: "Play Again", onPress: initializeGame }
      ]);
    }
  };

  const attemptMove = (destLocation, destPileIndex) => {
    if (!selectedCard) return;

    const { location: srcLocation, pileIndex: srcPileIndex, cardIndex: srcCardIndex } = selectedCard;
    
    // Can't move to the same place we selected from
    if (srcLocation === destLocation && srcPileIndex === destPileIndex) {
      setSelectedCard(null);
      return;
    }

    // Get the moving cards
    let movingCards = [];
    if (srcLocation === 'waste') {
      movingCards = [waste[waste.length - 1]];
    } else if (srcLocation === 'tableau') {
      movingCards = tableau[srcPileIndex].slice(srcCardIndex);
    } else if (srcLocation === 'foundation') {
      movingCards = [foundations[srcPileIndex][foundations[srcPileIndex].length - 1]];
    }

    if (movingCards.length === 0) return;
    const baseCard = movingCards[0];

    let isValidMove = false;

    // Validate move to foundation
    if (destLocation === 'foundation') {
      if (movingCards.length > 1) {
        setSelectedCard(null);
        return; // Can only move one card to foundation
      }
      
      const targetPile = foundations[destPileIndex];
      if (targetPile.length === 0) {
        isValidMove = baseCard.value === 'A';
      } else {
        const topCard = targetPile[targetPile.length - 1];
        isValidMove = baseCard.suit === topCard.suit && getValueRanking(baseCard.value) === getValueRanking(topCard.value) + 1;
      }
      
      if (isValidMove) {
        const newFoundations = [...foundations];
        newFoundations[destPileIndex] = [...newFoundations[destPileIndex], baseCard];
        setFoundations(newFoundations);
        checkWinCondition(newFoundations);
      }
    } 
    // Validate move to tableau
    else if (destLocation === 'tableau') {
      const targetPile = tableau[destPileIndex];
      if (targetPile.length === 0) {
        isValidMove = baseCard.value === 'K';
      } else {
        const topCard = targetPile[targetPile.length - 1];
        isValidMove = topCard.isFaceUp && isRed(baseCard.suit) !== isRed(topCard.suit) && getValueRanking(baseCard.value) === getValueRanking(topCard.value) - 1;
      }

      if (isValidMove) {
        const newTableau = [...tableau];
        newTableau[destPileIndex] = [...newTableau[destPileIndex], ...movingCards];
        setTableau(newTableau);
      }
    }

    if (isValidMove) {
      // Remove from source
      if (srcLocation === 'waste') {
        const newWaste = [...waste];
        newWaste.pop();
        setWaste(newWaste);
      } else if (srcLocation === 'tableau') {
        const newTableau = [...tableau];
        newTableau[srcPileIndex] = newTableau[srcPileIndex].slice(0, srcCardIndex);
        // Auto flip revealed card
        if (newTableau[srcPileIndex].length > 0) {
          newTableau[srcPileIndex][newTableau[srcPileIndex].length - 1].isFaceUp = true;
        }
        setTableau(newTableau);
      } else if (srcLocation === 'foundation') {
        const newFoundations = [...foundations];
        newFoundations[srcPileIndex].pop();
        setFoundations(newFoundations);
      }
    }

    setSelectedCard(null);
  };

  const handleWasteTap = () => {
    if (waste.length === 0) return;
    
    if (selectedCard && selectedCard.location === 'waste') {
      setSelectedCard(null); // Deselect
    } else if (selectedCard) {
      setSelectedCard(null); // Invalid move to waste
    } else {
      setSelectedCard({ location: 'waste', pileIndex: 0, cardIndex: waste.length - 1 });
    }
  };

  const handleFoundationTap = (pileIndex) => {
    if (selectedCard) {
      attemptMove('foundation', pileIndex);
    } else if (foundations[pileIndex].length > 0) {
      setSelectedCard({ location: 'foundation', pileIndex, cardIndex: foundations[pileIndex].length - 1 });
    }
  };

  const handleTableauTap = (pileIndex, cardIndex, card) => {
    if (selectedCard) {
      attemptMove('tableau', pileIndex);
    } else {
      // Only allow selecting face up cards
      if (card && card.isFaceUp) {
        setSelectedCard({ location: 'tableau', pileIndex, cardIndex });
      } else if (tableau[pileIndex].length === 0) {
        // Tapped empty pile when trying to move a king - wait, attemptMove handles this if selectedCard was true.
        // If no selectedCard, tapping empty pile does nothing.
      }
    }
  };

  const isSelected = (location, pileIndex, cardIndex) => {
    if (!selectedCard) return false;
    if (location === 'tableau') {
      return selectedCard.location === location && selectedCard.pileIndex === pileIndex && cardIndex >= selectedCard.cardIndex;
    }
    return selectedCard.location === location && selectedCard.pileIndex === pileIndex && selectedCard.cardIndex === cardIndex;
  };

  const renderCard = (card, location, pileIndex, cardIndex, style = {}) => {
    if (!card) {
      // Empty slot
      return (
        <View style={[styles.cardSlot, style]}>
        </View>
      );
    }

    const selected = isSelected(location, pileIndex, cardIndex);

    if (!card.isFaceUp) {
      return (
        <View style={[styles.card, styles.cardBack, style, selected && styles.cardSelected]}>
          <View style={styles.cardBackPattern} />
        </View>
      );
    }

    const color = isRed(card.suit) ? '#ef4444' : '#111827';
    
    return (
      <View style={[styles.card, style, selected && styles.cardSelected]}>
        <Text style={[styles.cardValueTop, { color }]}>{card.value}{card.suit}</Text>
        <Text style={[styles.cardSuitCenter, { color }]}>{card.suit}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Top row: Stock, Waste, spacer, Foundations */}
      <View style={styles.topRow}>
        <View style={styles.stockWasteContainer}>
          <TouchableOpacity onPress={handleStockTap} activeOpacity={0.8}>
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

          <TouchableOpacity onPress={handleWasteTap} activeOpacity={0.8} style={styles.wasteContainer}>
            {waste.length > 0 ? renderCard(waste[waste.length - 1], 'waste', 0, waste.length - 1) : renderCard(null)}
          </TouchableOpacity>
        </View>

        <View style={styles.foundationsContainer}>
          {foundations.map((f, index) => (
            <TouchableOpacity key={`f-${index}`} onPress={() => handleFoundationTap(index)} activeOpacity={0.8} style={styles.foundationPile}>
              {f.length > 0 ? renderCard(f[f.length - 1], 'foundation', index, f.length - 1) : renderCard(null)}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main Tableau */}
      <View style={styles.tableauContainer}>
        {tableau.map((pile, pileIndex) => (
          <TouchableOpacity 
            key={`t-${pileIndex}`} 
            style={styles.tableauColumn}
            activeOpacity={1}
            onPress={() => {
              if (pile.length === 0) {
                handleTableauTap(pileIndex, -1, null);
              } else {
                handleTableauTap(pileIndex, pile.length - 1, pile[pile.length - 1]); // fallback if tapped below cards
              }
            }}
          >
            {pile.length === 0 && renderCard(null)}
            {pile.map((card, cardIndex) => (
              <TouchableOpacity
                key={card.id}
                style={[styles.tableauCardWrapper, { top: cardIndex * 22 }]}
                activeOpacity={0.9}
                onPress={(e) => {
                  e.stopPropagation();
                  handleTableauTap(pileIndex, cardIndex, card);
                }}
              >
                {renderCard(card, 'tableau', pileIndex, cardIndex)}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity style={styles.restartButton} onPress={initializeGame}>
        <Text style={styles.restartText}>Restart Game</Text>
      </TouchableOpacity>
      
    </SafeAreaView>
  );
}

const windowWidth = Dimensions.get('window').width;
const cardWidth = (windowWidth - 32 - 30) / 7; // padding, gaps
const cardHeight = cardWidth * 1.4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f5132', // Classic green felt
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 24,
    zIndex: 10,
  },
  stockWasteContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  wasteContainer: {
    marginLeft: 8,
  },
  foundationsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  foundationPile: {
  },
  recycleIcon: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.3)',
  },
  tableauContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  tableauColumn: {
    width: cardWidth,
    minHeight: cardHeight, // Allows tapping empty columns
  },
  tableauCardWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardSlot: {
    width: cardWidth,
    height: cardHeight,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: cardWidth,
    height: cardHeight,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  cardBack: {
    backgroundColor: '#1d4ed8', // Blue back
    borderColor: '#fff',
    borderWidth: 2,
    padding: 3,
  },
  cardBackPattern: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
  cardSelected: {
    borderColor: '#fbbf24', // Yellow highlight
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  cardValueTop: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardSuitCenter: {
    fontSize: 24,
    textAlign: 'center',
    marginTop: -4,
  },
  restartButton: {
    alignSelf: 'center',
    padding: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  restartText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});