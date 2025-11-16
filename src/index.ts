import express, { type NextFunction, type Request, type Response } from "express";
import * as fs from "fs/promises";

const app = express();
const PORT = 8080;

app.use(express.json());

let userId = 0;
const dbPath = "data.txt";

// type definitions
enum Status {
    Confirmed,
    Cancelled,
}

interface Booking {
    bookingId: string;
    showId: number;
    movieId: number;
    seats: number;
    totalAmount: number;
    status: Status;
    bookingDate: string;
}

interface Show {
    showId: number;
    time: string;
    pricePerSeat: number;
    availableSeats: number;
}

interface Movie {
    id: number;
    title: string;
    genre: string;
    duration: number;
    shows: Show[];
}

interface User {
    id: number;
    username?: string;
    email: string;
    password?: string;
    bookings: Booking[];
}

interface Db {
    users: User[];
    movies: Movie[];
}

// db helpers
async function readFile(): Promise<Db> {
    const fileContents = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(fileContents) as Db;
}

async function writeFile(content: Db) {
    await fs.writeFile(dbPath, JSON.stringify(content, null, 2));
}

// middlewares
async function checkUserAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const { email, password } = req.body;
    const db = await readFile();
    const user = db.users.find((entry) => entry.email === email && entry.password === password);

    console.log("Auth status -", !!user);

    if (!user) {
        return res.status(400).send("User auth failed");
    }

    return next();
}

// routes
app.post("/signup", async (req: Request, res: Response) => {
    const { username, password, email } = req.body;

    const user: User = {
        id: userId,
        username,
        email,
        password,
        bookings: [],
    };
    userId++;

    try {
        const db = await readFile();
        db.users.push(user);
        await writeFile(db);

        return res.status(201).json({
            message: "User created successfully",
            userId: user.id,
        });
    } catch (error) {
        console.log("Error in signup route -", error);
        return res.status(500).send("Some error occurred");
    }
});

app.get("/movies", async (req: Request, res: Response) => {
    try {
        const db = await readFile();
        return res.json(db.movies);
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.get("/movies/:movieId", async (req: Request, res: Response) => {
    const movieId = Number(req.params.movieId);

    try {
        const db = await readFile();
        const movie = db.movies.find((entry) => entry.id === movieId);

        if (!movie) {
            return res.status(404).json({ message: "Movie not found" });
        }

        return res.json(movie);
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.get("/movies/:movieId/shows", async (req: Request, res: Response) => {
    const movieId = Number(req.params.movieId);

    try {
        const db = await readFile();
        const movie = db.movies.find((entry) => entry.id === movieId);

        if (!movie) {
            return res.status(404).json({ message: "Movie not found" });
        }

        return res.json(movie.shows);
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.post("/bookings/:userId", async (req: Request, res: Response) => {
    const { movieId, showId, seats } = req.body;
    const userId = Number(req.params.userId);

    try {
        const db = await readFile();

        const movie = db.movies.find((entry) => entry.id === Number(movieId));
        if (!movie) {
            return res.status(404).json({ message: "Movie not found" });
        }
        const movieIndex = db.movies.indexOf(movie);

        const user = db.users.find((entry) => entry.id === userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const userIndex = db.users.indexOf(user);

        const show = movie.shows.find((entry) => entry.showId === Number(showId));
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        const showIndex = movie.shows.indexOf(show);

        if (show.availableSeats < seats) {
            return res.status(400).json({ message: "Not enough seats available" });
        }

        const bookingId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const totalAmount = seats * show.pricePerSeat;
        const booking: Booking = {
            bookingId,
            movieId: movie.id,
            showId: show.showId,
            seats,
            totalAmount,
            status: Status.Confirmed,
            bookingDate: new Date().toISOString(),
        };

        show.availableSeats -= seats;
        movie.shows[showIndex] = show;
        db.movies[movieIndex] = movie;

        user.bookings.push(booking);
        db.users[userIndex] = user;

        await writeFile(db);

        return res.json({
            message: "Booking successful",
            bookingId,
            movieTitle: movie.title,
            showTime: show.time,
            seats,
            totalAmount,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.get("/bookings/:userId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);

    try {
        const db = await readFile();
        const user = db.users.find((entry) => entry.id === userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.bookings || user.bookings.length === 0) {
            return res.status(404).json({ message: "User has no bookings" });
        }

        return res.json(user.bookings);
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.get("/bookings/:userId/:bookingId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    const bookingId = req.params.bookingId;

    try {
        const db = await readFile();
        const user = db.users.find((entry) => entry.id === userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.bookings || user.bookings.length === 0) {
            return res.status(404).json({ message: "User has no bookings" });
        }

        const booking = user.bookings.find((entry) => entry.bookingId === bookingId);

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        return res.json(booking);
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.put("/bookings/:userId/:bookingId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    const bookingId = req.params.bookingId;
    const { seats } = req.body;

    try {
        const db = await readFile();

        const user = db.users.find((entry) => entry.id === userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const userIndex = db.users.indexOf(user);

        if (!user.bookings || user.bookings.length === 0) {
            return res.status(404).json({ message: "User has no bookings" });
        }

        const booking = user.bookings.find((entry) => entry.bookingId === bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const movie = db.movies.find((entry) => entry.id === booking.movieId);
        if (!movie) {
            return res.status(404).json({ message: "Movie not found" });
        }
        const movieIndex = db.movies.indexOf(movie);

        const show = movie.shows.find((entry) => entry.showId === booking.showId);
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        const showIndex = movie.shows.indexOf(show);

        const seatDifference = seats - booking.seats;

        if (seatDifference > 0 && show.availableSeats < seatDifference) {
            return res.status(400).json({ message: "Not enough seats available" });
        }

        show.availableSeats -= seatDifference;
        movie.shows[showIndex] = show;
        db.movies[movieIndex] = movie;

        const totalAmount = seats * show.pricePerSeat;
        const updatedBooking: Booking = {
            ...booking,
            seats,
            totalAmount,
            status: Status.Confirmed,
            bookingDate: new Date().toISOString(),
        };

        const bookingIdx = user.bookings.indexOf(booking);
        user.bookings[bookingIdx] = updatedBooking;
        db.users[userIndex] = user;

        await writeFile(db);

        return res.json({
            message: "Booking updated successfully",
            bookingId: booking.bookingId,
            seats,
            totalAmount,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.delete("/bookings/:userId/:bookingId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    const bookingId = req.params.bookingId;

    try {
        const db = await readFile();

        const user = db.users.find((entry) => entry.id === userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const userIndex = db.users.indexOf(user);

        if (!user.bookings || user.bookings.length === 0) {
            return res.status(404).json({ message: "User has no bookings" });
        }

        const booking = user.bookings.find((entry) => entry.bookingId === bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const movie = db.movies.find((entry) => entry.id === booking.movieId);
        if (!movie) {
            return res.status(404).json({ message: "Movie not found" });
        }
        const movieIndex = db.movies.indexOf(movie);

        const show = movie.shows.find((entry) => entry.showId === booking.showId);
        if (!show) {
            return res.status(404).json({ message: "Show not found" });
        }
        const showIndex = movie.shows.indexOf(show);

        const cancelledBooking: Booking = {
            ...booking,
            status: Status.Cancelled,
            bookingDate: new Date().toISOString(),
        };


        show.availableSeats += booking.seats;
        movie.shows[showIndex] = show;
        db.movies[movieIndex] = movie;

        const bookingIdx = user.bookings.indexOf(booking);
        user.bookings[bookingIdx] = cancelledBooking;
        db.users[userIndex] = user;

        await writeFile(db);

        return res.json({ message: "Booking cancelled successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.get("/summary/:userId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);

    try {
        const db = await readFile();
        const user = db.users.find((entry) => entry.id === userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const bookings = user.bookings ?? [];

        const totalBookings = bookings.length;
        const confirmedBookings = bookings.filter((b) => b.status === Status.Confirmed).length;
        const cancelledBookings = bookings.filter((b) => b.status === Status.Cancelled).length;

        const confirmedBookingsList = bookings.filter((b) => b.status === Status.Confirmed);

        let totalAmountSpent = 0;
        let totalSeatsBooked = 0;

        confirmedBookingsList.forEach((entry) => {
            totalAmountSpent += entry.totalAmount;
            totalSeatsBooked += entry.seats;
        });

        const response = {
            userId,
            userName: user.username ?? null,
            totalBookings,
            totalAmountSpent,
            confirmedBookings,
            cancelledBookings,
            totalSeatsBooked,
        };

        return res.json(response);
    } catch (error) {
        console.log(error);
        return res.status(500).send("Some error occurred");
    }
});

app.listen(PORT, () => {
    console.log("Listening on port -", PORT);
});
