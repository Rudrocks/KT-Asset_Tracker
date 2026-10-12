require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');
const port = Number(process.env.PORT) || 3000;

sequelize.sync()
  .then(() => {
    app.listen(port, () => {
      console.log(`Asset tracker listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Unable to connect to PostgreSQL or initialize the database:', error);
    process.exitCode = 1;
  });
