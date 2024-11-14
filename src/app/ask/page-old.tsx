'use client';

import fs from 'fs';
import path from 'path';
import { useChat } from 'ai/react';
import { useState, useEffect } from 'react';
import NavBar from '../component/navbar';
import { CardSkeleton, FormSkeleton } from "@leafygreen-ui/skeleton-loader";
import ItineraryCards from '../component/cards';
import { GoogleMap, LoadScript, Marker, useJsApiLoader } from '@react-google-maps/api';
import LeafyGreenProvider from '@leafygreen-ui/leafygreen-provider';
import { Days, CustomTextInput, PlanButton } from '../component/prompt2';
import TextInput from '@leafygreen-ui/text-input';
import TextArea from '@leafygreen-ui/text-area';
import { NumberInput } from '@leafygreen-ui/number-input';
import Button from "@leafygreen-ui/button";
import Icon from "@leafygreen-ui/icon";
import Modal from "@leafygreen-ui/modal";
import { css } from "@leafygreen-ui/emotion";
import Tooltip from "@leafygreen-ui/tooltip";
import MarkdownRenderer from '../component/markdown';

export default function Home() {
  const [waitingForAI, setWaitingForAI] = useState<boolean>(false);
  const { messages, input, handleInputChange, setInput, handleSubmit, isLoading } = useChat();
  const [locations, setLocations] = useState<{ lat: number, lng: number, title: string }[]>([{ lat: 0, lng: 0, title: 'The center of the world' }]);
  
  // Get users location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            title: 'Journey Begins Here',
          };
          setLocations([userLocation]);
        },
        (error) => {
          console.error("Error getting user's location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);
  const [duration, setDuration] = useState<string>();
  const [location, setLocation] = useState<string>();
  const [theme, setTheme] = useState<string>();
  const [travelingWith, setTravelingWith] = useState<string>();
  const [otherSpecifications, setOtherSpecifications] = useState<string>(); 
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  interface Itinerary {
    day: string;
    title: string;
    activities: [];
  }


  const [itinerary, setItinerary] = useState<Itinerary[]>([]);
  useEffect(() => {
    const newPrompt = `Plan a trip to ${location} for ${duration} days with a ${theme} theme, traveling with ${travelingWith}. Other specifications: ${otherSpecifications}.`;
    // setPrompt(newPrompt);
    setInput(newPrompt);
  }, [duration, location, theme, travelingWith, otherSpecifications]);

  function extractAndConvertMarkdownToJson(markdownString: string): any {
    try {
      // Extract the JSON string from the Markdown content
      const match = markdownString.match(/```json([\s\S]*?)```/);
      const jsonString = match ? match[1].trim() : '';
      // Parse the JSON string
      const parsedData = JSON.parse(jsonString);
      const coordinates: any[] = [];
      parsedData.forEach((day: { activities: any[]; }) => {
        day.activities.forEach(activity => {
          if (activity.location) {
            coordinates.push({lat : activity.location.lat, lng: activity.location.lng, title: activity.activity});
          }
        });
      setLocations(coordinates);
      });

      console.log("jsonString", parsedData, locations);

      return parsedData;
    } catch (error) {
      console.error('Error parsing data:', error);
      return null;
    }
  }

  useEffect(() => {
    setWaitingForAI(true);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        setWaitingForAI(false);
        setItinerary(extractAndConvertMarkdownToJson(lastMessage.content));
        // setWaitingForAI(true); // Remove to show json
      }
    }
  }, [messages]);


  return (
    <LoadScript googleMapsApiKey="AIzaSyANzZ98TYECmb36brHpfo6dLHeOnScmZWA">
      <div>
        <LeafyGreenProvider baseFontSize={16}>
          <NavBar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

          <form className="chat-window" onSubmit={handleSubmit}>
            <div className="prompt-options">

              <TextInput
                label="📍 Planning to visit"
                placeholder="Bahamas, Vegas, etc."
                // value="Vegas"
                onChange={(e) => setLocation(e.target.value)}
              />
              <TextInput
                label="🎨 Theme"
                placeholder="Art, Adventure, etc."
                // value="Art"
                onChange={(e) => setTheme(e.target.value)}
              />
              <TextInput
                label="👥 Traveling with"
                placeholder="Friends, Family, etc."
                // value="Friends"
                onChange={(e) => setTravelingWith(e.target.value)}
              />
              <TextInput
                label="Other specification(s)"
                placeholder="Museum, Beach, etc."
                // value="Museum"
                onChange={(e) => setOtherSpecifications(e.target.value)}
              />
              <NumberInput
                label="🗓 Duration "
                unit="Days"
                placeholder="3, 5, etc."
                // value="2"
                onChange={(e) => setDuration(e.target.value.toString())}
              />
              <div style={{ borderLeft: "1px solid #ccc", height: "100%", margin: "0 20px" }}></div>
            </div>
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask what you have in mind"
              hidden
            />
            <Button
              type="submit"
              rightGlyph={<Icon glyph="Sparkle" />}
              variant="baseGreen"
              isLoading={isLoading}
              loadingText={"working on it..."}
              style={{ alignSelf: "center", width: "15%", height: '6vh', fontSize: 'medium' }}
            >
              Make It Happen
            </Button>
          </form>

          <div style={{ marginTop: '10%', padding: '5%', display: "flex", justifyContent: 'space-evenly' }}>
            <CardSkeleton hidden={!waitingForAI || !isLoading} style={{ padding: "5%", width: "35vw" }} />
            <>
              {waitingForAI && !isLoading && (
                <div style={{ overflow: "auto", width: '35vw', display: 'flex', flexDirection: 'column' }} >
                  {itinerary?.length > 0 ? (
                    itinerary.map((dayPlan, index) => (
                      <ItineraryCards key={index} title={`Day ${dayPlan.day}`} description={dayPlan.title} activities={dayPlan.activities} />
                    ))
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                      <i>
                        <h1 style={{ color: '#6666', fontSize: 'larger' }}>
                          “Traveling—it leaves you speechless, then turns you into a storyteller.”— Ibn Battuta
                        </h1>
                      </i>
                    </div>
                  )}
                  <Tooltip trigger={<Button
                    variant="default"
                    disabled={isLoading}
                    style={{
                      marginBottom: '10px',
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'absolute',
                      right: '20px'
                    }}
                    onClick={() => setOpen((o) => !o)}
                  >
                    <Icon glyph='Edit'> </Icon>

                  </Button>}>
                    Ask for changes
                  </Tooltip>
                  <Modal
                    className={css`
                  div[role="dialog"] {
                  width: 800px;
                  }
                `}
                    open={open}
                    setOpen={setOpen}
                  >
                    <form onSubmit={handleSubmit} style={{ marginTop: "10px" }}>
                      <TextArea
                        label=""
                        placeholder="Make my trip..."
                        onChange={(e) => setInput(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                        <Button
                          type='submit'
                          onClick={() => setOpen(false)}
                        >
                          Make Changes
                        </Button>
                      </div>
                    </form>
                  </Modal>

                </div>
              )}
              {!waitingForAI && (
                <div>
                  <MarkdownRenderer
                    content={messages.length > 0 && messages[messages.length - 1].role !== 'user' ? messages[messages.length - 1].content : ''}
                  />
                  <Button
                    variant="default"
                    disabled={isLoading}
                    style={{ marginTop: '0px', width: '100%' }}
                    onClick={() => { 
                      setWaitingForAI(true); 
                      console.log(waitingForAI); }}
                  >
                    Prettify
                  </Button>
                </div>)
              }
            </>
            <div style={{ borderLeft: '1px solid #ccc', margin: '0 0px' }}></div>

            {/* "AIzaSyANzZ98TYECmb36brHpfo6dLHeOnScmZWA"> */}
            {locations.length > 0 &&
                <GoogleMap
                  mapContainerStyle={{
                  width: '70vh',
                  height: '60vh',
                  borderRadius: '10px',
                  }}
                  center={locations[0]}
                  zoom={12}
                  options={{
                  styles: [
                    { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
                    {
                      elementType: "labels.text.stroke",
                      stylers: [{ color: "#f5f1e6" }],
                    },
                    {
                      featureType: "administrative",
                      elementType: "geometry.stroke",
                      stylers: [{ color: "#c9b2a6" }],
                    },
                    {
                      featureType: "administrative.land_parcel",
                      elementType: "geometry.stroke",
                      stylers: [{ color: "#dcd2be" }],
                    },
                    {
                      featureType: "administrative.land_parcel",
                      elementType: "labels.text.fill",
                      stylers: [{ color: "#ae9e90" }],
                    },
                    {
                      featureType: "landscape.natural",
                      elementType: "geometry",
                      stylers: [{ color: "#dfd2ae" }],
                    },
                    {
                      featureType: "poi",
                      elementType: "geometry",
                      stylers: [{ color: "#dfd2ae" }],
                    },
                    {
                      featureType: "poi",
                      elementType: "labels.text.fill",
                      stylers: [{ color: "#93817c" }],
                    },
                    {
                      featureType: "poi.park",
                      elementType: "geometry.fill",
                      stylers: [{ color: "#a5b076" }],
                    },
                    {
                      featureType: "poi.park",
                      elementType: "labels.text.fill",
                      stylers: [{ color: "#447530" }],
                    },
                    {
                      featureType: "road",
                      elementType: "geometry",
                      stylers: [{ color: "#f5f1e6" }],
                    },
                    {
                      featureType: "road.arterial",
                      elementType: "geometry",
                      stylers: [{ color: "#fdfcf8" }],
                    },
                    {
                      featureType: "road.highway",
                      elementType: "geometry",
                      stylers: [{ color: "#f8c967" }],
                    },
                    {
                      featureType: "road.highway",
                      elementType: "geometry.stroke",
                      stylers: [{ color: "#e9bc62" }],
                    },
                    {
                      featureType: "road.highway.controlled_access",
                      elementType: "geometry",
                      stylers: [{ color: "#e98d58" }],
                    },
                    {
                      featureType: "road.highway.controlled_access",
                      elementType: "geometry.stroke",
                      stylers: [{ color: "#db8555" }],
                    },
                    {
                      featureType: "road.local",
                      elementType: "labels.text.fill",
                      stylers: [{ color: "#806b63" }],
                    },
                    {
                      featureType: "transit.line",
                      elementType: "geometry",
                      stylers: [{ color: "#dfd2ae" }],
                    },
                    {
                      featureType: "transit.line",
                      elementType: "labels.text.fill",
                      stylers: [{ color: "#8f7d77" }],
                    },
                    {
                      featureType: "transit.line",
                      elementType: "labels.text.stroke",
                      stylers: [{ color: "#ebe3cd" }],
                    },
                    {
                      featureType: "transit.station",
                      elementType: "geometry",
                      stylers: [{ color: "#dfd2ae" }],
                    },
                    {
                      featureType: "water",
                      elementType: "geometry.fill",
                      stylers: [{ color: "#b9d3c2" }],
                    },
                    {
                      featureType: "water",
                      elementType: "labels.text.fill",
                      stylers: [{ color: "#92998d" }],
                    },
                  ],
                  }}
                  onLoad={map => {
                  if (locations.length > 1) {
                    map.panTo(locations[locations.length - 1]);
                  }
                  }}
                >
                  {locations?.map((loc, index) => (
                  <Marker 
                    key={index} 
                    position={{ lat: loc.lat, lng: loc.lng }} 
                    icon={{
                    url: `map.png`,
                    }}                   
                    title={loc.title} 
                    onClick={() => {
                      const infoWindow = new google.maps.InfoWindow({
                        content: `<h3>Location ${index + 1}</h3>`
                      });
                      // infoWindow.open({anchor:  , shouldFocus: false});
                    }}
                  />
                  ))}
                </GoogleMap>
            }
          </div>

          <p style={{ color: "gray", fontSize: 'small', textAlign: 'center' }}>
            Made with ❤️ by <a href="https://www.linkedin.com/in/utsav-talwar/" target="_blank" rel="noopener noreferrer">Utsav Talwar</a>
          </p>

        </LeafyGreenProvider>
      </div>
    </LoadScript>
  );
}