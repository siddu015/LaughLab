// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Make the API call to Express server
        axios.get('http://localhost:3000/api/data')
            .then(response => {
                setMessage(response.data.message); // Set state with data from Express
            })
            .catch(error => {
                console.error('There was an error fetching the data!', error);
            });
    }, []);

    return (
        <div>
            <h1>{message}</h1>
        </div>
    );
}

export default App;
