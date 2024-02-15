const express = require("express");
const path = require("path");
const collection = require("./config");
const axios = require("axios");
const bodyParser = require("body-parser");
const session = require("express-session");
const app = express();
const port = 3000;

app.use(session({ secret: "your-secret-key", resave: true, saveUninitialized: true }));
app.use(express.static(__dirname + '../public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use('/api', express.static(path.join(__dirname, 'api')));
app.use(express.static(path.join(__dirname, '../public')));

let existingHtml = "";

app.get("/", (req, res) => {
    res.render("login");
});

app.get("/api/weather", (req, res) => {
    res.render("../api/weather", { existingHtml: existingHtml });
});

app.get("/api/urban-dictionary", (req, res) => {
    res.render("../api/urban", { meanings: null });
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/home", (req, res) => {
    res.render("../views/home");
});

app.get("/api/movies", (req, res) => {
    res.render("../api/movies", { movies: null });
});

app.post("/signup", async (req, res) => {
    const data = {
        name: req.body.username,
        password: req.body.password
    };

    try {
        const existingUser = await collection.UserModel.findOne({ name: data.name });

        if (existingUser) {
            res.send('User already exists. Please choose a different username.');
        } else {
            await collection.UserModel.create(data);
            res.send('User registered successfully. Now please Login and you can use the website');
        }
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).send('An error occurred during signup.');
    }
});

app.post("/login", async (req, res) => {
    try {
        const check = await collection.UserModel.findOne({ name: req.body.username });

        if (!check) {
            res.send("User name not found");
        } else if (check.password !== req.body.password) {
            res.send("Incorrect password");
        } else {
            req.session.userName = check.name;
            res.render("home");
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('An error occurred during login.');
    }
});

app.post("/search", async (req, res) => {
    const city = req.body.city;
    const apiKey = '394f7ad19bb5c5525c4ddb18324358d7';

    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=394f7ad19bb5c5525c4ddb18324358d7`
        );

        const weatherData = response.data;
        const temperature = weatherData.main.temp;
        const feelsLike = weatherData.main.feels_like;
        const weatherIcon = weatherData.weather[0].icon;

        const additionalContent = { city: city, temperature: temperature, feelsLike: feelsLike, weatherIcon: weatherIcon };
        const userName = req.session.userName;

        await collection.UserActionModel.create({
            username: userName,
            action: `Search weather for ${city}`,
            date: new Date(),
        });

        existingHtml = additionalContent;
        res.redirect('/api/weather');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching weather data");
    }
});

const fetchMeanings = async (word) => {
    try {
        const response = await axios.get(`https://api.urbandictionary.com/v0/define?term=${word}`);
        return response.data.list;
    } catch (error) {
        console.error("Error fetching Urban Dictionary data:", error);
        throw error;
    }
};

app.get("/api/urban-dictionary", async (req, res) => {
    try {
        const meanings = await fetchMeanings();
        res.render("../api/urban", { meanings });
    } catch (error) {
        console.error("Error fetching Urban Dictionary data:", error);
        res.render("../api/urban", { meanings: [] });
    }
});

app.post("/api/search-word", async (req, res) => {
    const word = req.body.word;

    try {
        const meanings = await fetchMeanings(word);
        const userName = req.session.userName;
        await collection.UserActionModel.create({
            username: userName,
            action: `Search word on Dictionary: ${word}`,
            date: new Date(),
        });

        res.render("../api/urban", { meanings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching Urban Dictionary data" });
    }
});

app.post("/api/movies", async (req, res) => {
    const movieTitle = req.body.movieTitle;

    try {
        const response = await axios.get(
            `https://moviesdatabase.p.rapidapi.com/titles/search/title/${movieTitle}`,
            {
                headers: {
                    'X-RapidAPI-Key': 'b7a46591c7msh9fd0404fd28ff29p1a4c3ejsn4be6a293c2f2',
                    'X-RapidAPI-Host': 'moviesdatabase.p.rapidapi.com'
                }
            }
        );

        const userName = req.session.userName; 

        await collection.UserActionModel.create({
            username: userName,
            action: `Search word on Movies: ${movieTitle}`,
            date: new Date(),
        });

        const movieData = response.data;
        res.render("../api/movies", { movies: movieData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error fetching movie data" });
    }
});


app.get("/history", async (req, res) => {
    try {
        const userName = req.session.userName;
        const userHistory = await collection.UserActionModel.find({ username: userName }).sort({ date: -1 });
        res.render("history", { userHistory });
    } catch (error) {
        console.error('Error fetching user history:', error);
        res.status(500).send('An error occurred while fetching user history.');
    }
});


app.get('/download-history', async (req, res) => {
    try {
        const histories = await collection.UserActionModel.find(); 
        const pdfDoc = new pdfkit();
        const stream = pdfDoc.pipe(blobStream());

        pdfDoc.text('Search History', { align: 'center', fontSize: 20, margin: 10 });

        histories.forEach(history => {
            pdfDoc.text(`Date: ${history.date}, Action: ${history.action}`, { margin: 5 });
        });

        pdfDoc.end();
        res.setHeader('Content-disposition', 'attachment; filename=search_history.pdf');
        res.setHeader('Content-type', 'application/pdf');

        stream.pipe(res);
    } catch (error) {
        console.error('Error fetching search history:', error);
        res.status(500).send('An error occurred while fetching search history.');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
