import axios from 'axios';

const API_BASE_URL = '/api';

export async function fetchAirports() {
  try {
    const response = await axios.get(`${API_BASE_URL}/airports`);
    return response.data;
  } catch (error) {
    console.error('Error fetching airports:', error);
    throw new Error('Failed to load airports');
  }
}

export async function searchFlights(searchParams) {
  try {
    const response = await axios.post(`${API_BASE_URL}/search`, searchParams);
    return response.data;
  } catch (error) {
    console.error('Error searching flights:', error);
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to search flights. Please try again later.');
  }
}