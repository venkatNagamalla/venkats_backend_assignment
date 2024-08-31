const express = require("express");
const bcrypt = require("bcryptjs"); // Use bcryptjs instead of bcrypt
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`App is starting at port ${port}`);
    });
  } catch (e) {
    console.log(`${e.message}`);
    process.exit(1);
  }
};

// Function to modify task object keys
const modifyTasks = (obj) => ({
  id: obj.id,
  title: obj.title,
  description: obj.description,
  status: obj.status,
  assigneeId: obj.assignee_id,
  createdAt: obj.created_at,
  updatedAt: obj.updated_at,
});

// Middleware function to authenticate the user
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers.authorization;
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "jwt_token", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid Access Token");
      } else {
        next();
      }
    });
  }
};

// API to register a new user
app.post("/register/", async (request, response) => {
  const { username, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUser = `SELECT * FROM Users WHERE username= '${username}'`;
  const user = await db.get(getUser);
  if (user === undefined) {
    const createUser = `INSERT INTO Users (username,password_hash,gender)
                        VALUES(
                          '${username}',
                          '${hashedPassword}',
                          '${gender}'
                        );`;
    await db.run(createUser);
    response.send("User Created Successfully");
  } else {
    response.status(400);
    response.send("Username already exists");
  }
});

// API to login a user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUser = `SELECT * FROM Users WHERE username = '${username}'`;
  const user = await db.get(getUser);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password_hash);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "jwt_token");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid Password");
    }
  }
});

// API to retrieve all users
app.get("/users/", authenticationToken, async (request, response) => {
  const getAllUsers = `SELECT username FROM Users`;
  const allUsers = await db.all(getAllUsers);
  response.send(allUsers);
});

// API to retrieve all tasks
app.get("/tasks/", authenticationToken, async (request, response) => {
  const getAllTasks = `SELECT * FROM Tasks`;
  const allTasks = await db.all(getAllTasks);
  response.send(allTasks.map((eachTask) => modifyTasks(eachTask)));
});

// API to retrieve a single task by ID
app.get("/tasks/:id/", authenticationToken, async (request, response) => {
  const { id } = request.params;
  const getTask = `SELECT * FROM Tasks WHERE id=${id}`;
  const task = await db.get(getTask);
  response.send(modifyTasks(task));
});

// API to create a new task
app.post("/tasks/", authenticationToken, async (request, response) => {
  const { title, description, status, assigneeId, createdAt, updatedAt } = request.body;
  const createNewTask = `INSERT INTO Tasks(
                          title,
                          description,
                          status,
                          assignee_id,
                          created_at,
                          updated_at
                        ) 
                        VALUES(
                          '${title}',
                          '${description}',
                          '${status}',
                          ${assigneeId},
                          '${createdAt}',
                          '${updatedAt}');`;
  await db.run(createNewTask);
  response.send("Task Added Successfully");
});

// API to update an existing task by ID
app.put("/tasks/:id", authenticationToken, async (request, response) => {
  const { id } = request.params;
  const { title, description, status, assigneeId, createdAt, updatedAt } = request.body;
  const updateTask = `UPDATE Tasks
                      SET 
                          title ='${title}', 
                          description='${description}', 
                          status='${status}', 
                          assignee_id=${assigneeId}, 
                          created_at='${createdAt}', 
                          updated_at='${updatedAt}' 
                      WHERE id=${id};`;
  await db.run(updateTask);
  response.send("Task Updated Successfully");
});

// API to delete a task by ID
app.delete("/tasks/:id", authenticationToken, async (request, response) => {
  const { id } = request.params;
  const deleteTask = `DELETE FROM Tasks WHERE id=${id}`;
  await db.run(deleteTask);
  response.send("Task Deleted Successfully");
});

// API to retrieve user tasks
app.get("/users/tasks/", authenticationToken, async (request, response) => {
  const getUsersTasks = `SELECT u.username AS name, u.gender AS gender, t.title AS title, t.status AS status, t.created_at AS createdDate, t.updated_at AS updatedDate 
                         FROM Users u 
                         INNER JOIN Tasks t ON u.id = t.assignee_id;`;
  const getTasks = await db.all(getUsersTasks);
  response.send(getTasks);
});

// API to get tasks assigned to a specific user by user ID
app.get("/users/tasks/:id", authenticationToken, async (request, response) => {
  const { id } = request.params;
  const getTasks = `SELECT * FROM Tasks WHERE assignee_id=${id}`;
  const getAllTasks = await db.all(getTasks);
  response.send(getAllTasks);
});

// Initialize database and server
initializeDbAndServer();
