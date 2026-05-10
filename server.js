// Загружаем рейсы из ВСЕХ сообщений в канале
async function loadFlights() {
  try {
    // Способ 1: пробуем загрузить через закреплённое сообщение
    const chatRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHANNEL_ID}`
    );
    const chatData = await chatRes.json();
    
    // Способ 2: получаем историю сообщений (последние 20)
    const updatesRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=30&allowed_updates=["channel_post","message"]`
    );
    const updatesData = await updatesRes.json();
    
    let allText = '';
    
    // Собираем текст из всех найденных сообщений
    if (updatesData.ok && updatesData.result.length > 0) {
      for (const update of updatesData.result) {
        const msg = update.channel_post || update.message;
        if (msg && String(msg.chat.id) === String(CHANNEL_ID) && msg.text) {
          allText += msg.text;
        }
      }
    }
    
    // Очищаем от меток частей
    const cleanText = allText.replace(/\[ЧАСТЬ \d+\]/g, '');
    
    if (cleanText.length > 10) {
      try {
        const flights = JSON.parse(cleanText);
        if (Array.isArray(flights) && flights.length > 0) {
          global.flightsCache = flights;
          return flights;
        }
      } catch(e) {
        console.log('Ошибка парсинга текста из getUpdates');
      }
    }
    
    // Способ 3: закреплённое сообщение (если getUpdates не сработал)
    if (chatData.ok && chatData.result.pinned_message && chatData.result.pinned_message.text) {
      const pinnedText = chatData.result.pinned_message.text.replace(/\[ЧАСТЬ \d+\]/g, '');
      try {
        const flights = JSON.parse(pinnedText);
        if (Array.isArray(flights) && flights.length > 0) {
          global.flightsCache = flights;
          return flights;
        }
      } catch(e) {}
    }
    
    // Если ничего не нашли — возвращаем кеш
    if (global.flightsCache.length > 0) {
      return global.flightsCache;
    }
    
  } catch (e) {
    console.log('Ошибка загрузки:', e.message);
  }
  return global.flightsCache || [];
}
