const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()
const bot = new TelegramBot(process.env.Telegram_Tokin, {polling: true});
const axios = require('axios');
const fs = require('fs');
const KosherZmanim = require("kosher-zmanim");


let userLocation ;

let nextFriday = new Date()
nextFriday.setDate(nextFriday.getDate()+ (5 - nextFriday.getDay()))


bot.onText(/start/, (msg) => {
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                [{text: 'Location Request', request_location: true}],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        }),
    };
    bot.sendMessage(msg.chat.id, 'нажмите на кнопку Location Request', opts);
});

bot.on('location', (msg) => {
    const lg = msg.from.language_code;
    const urlPlace = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${msg.location.latitude},${msg.location.longitude}&key=${process.env.googl_aip_key}&language=${lg}`
    const urlTimezone = `https://maps.googleapis.com/maps/api/timezone/json?location=${msg.location.latitude}%2C${msg.location.longitude}&timestamp=1331161200&key=${process.env.googl_aip_key}`

    axios.get(urlPlace)
        .then( res => {
            axios.get(urlTimezone)
                .then( tzres => {
                    // console.log(tzres.data.timeZoneId)

                    let location = res.data.plus_code.compound_code
                    location = location.slice( location.indexOf(' ') + 1 )
                    console.log("Location", location)

                    const currDate = new Date();

                    const nextFriday = new Date();
                    nextFriday.setUTCDate( nextFriday.getUTCDate() + 5 - nextFriday.getUTCDay() )
                    nextFriday.setUTCHours( 12, 0, 0, 0 );

                    if (nextFriday - currDate < 0) {
                        nextFriday.setUTCDate( nextFriday.getUTCDate() + 7 )
                    }
                    // текДень = 3 сен 20:00
                    // nextFr = 3 сен 20:00
                    // устДату( 3 + 5 - 6 ) - 2 сен 16:00
                    // устВремя 12:00 - 2 сен 12:00

                    const shabathTime = getCandleTime({
                        latitude: msg.location.latitude,
                        longitude: msg.location.longitude,
                        timeZoneId: tzres.data.timeZoneId,
                        date: nextFriday
                    });
                    const options = { month: 'long', day: 'numeric' };
                    bot.sendMessage(
                        msg.chat.id,
                        `📍 ${location}\nШабат: ${nextFriday.toLocaleDateString(lg, options)}\nЗажигание 🕯🕯 в ${shabathTime.time}`
                    )

                    setTimeout( 
                        () => sendCandleTime(msg.chat.id, msg.location.latitude, msg.location.longitude),
                        nextFriday - currDate
                    )
                })
        })
    

});

function getCandleTime ( {latitude, longitude, timeZoneId, date} ){
    const options = { date, latitude, longitude, timeZoneId };
    const zmanim = KosherZmanim.getZmanimJson(options);
    const Dat =  new Date(zmanim.BasicZmanim.CandleLighting)
    const kostyli = zmanim.BasicZmanim.CandleLighting.split('T')[1].split(':').splice(0, 2).join(':')
    const ShabatTime = {
        date: Dat.toDateString(),
        time: kostyli
    }
    
    return ShabatTime
}
function sendCandleTime( chatID, latitude, longitude ) {
    const shabath = getCandleTime( latitude, longitude, new Date() )
    bot.sendMessage(chatID,`шабат дата ${shabath.date} шабат время ${shabath.time}`)
    setTimeout( () => sendCandleTime(chatID, latitude, longitude), 60480000)
}
    