import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API ALL IN ONE FITNESS',
            version: '1.0.0',
            description: 'Documentación de la API para la aplicación ALL IN ONE FITNESS. Esta API permite gestionar el registro de usuarios, el seguimiento de comidas, ejercicios y rutinas, así como el cálculo y almacenamiento del 1RM (One Rep Max).',
            contact: {
                name: 'Camilo Marin, Daniel Ortiz, Emanuel Londoño, Felipe Torres'
            }
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Local server'
            }
        ]
    },
    apis: ['./swagger/*.yml']
};

const specs = swaggerJsdoc(options);
export default specs;