const { app } = require('./app');
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Banking portal listening on port ${port}`));
