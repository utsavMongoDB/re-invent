import "../fonts.css";
import { useState } from "react";
import ExpandableCard from "@leafygreen-ui/expandable-card";
import LeafyGreenProvider from "@leafygreen-ui/leafygreen-provider";

interface Activities {
  time: string;
  activity : string;
  details: string;
  location: {
    lat: number;
    lng: number;
  };
}

interface ItineraryCardsProps {
  title: string;
  description: string;
  activities: Activities[];
}

const ItineraryCards: React.FC<ItineraryCardsProps> = ({ title, description, activities }) => {
  return (
    <ExpandableCard
      title={title}
      description={description}
      // flagText="optional"
      style={{ marginBottom: "1rem", width: "35vw", alignSelf: "center", fontSize:'large' }}
    >
      <ul>
        {activities?.map((item, index) => (
          <div>
            <li className="activitiesData" key={index}><strong>{item.time}</strong> | {item.activity}</li>
            {/* <li className="activitiesData" key={index}></li> */}
            <li className="activitiesData" style={{fontSize:'small'}} key={index}><em>{item.details}</em></li>
            <hr></hr>
          </div>
        ))}
      </ul>
    </ExpandableCard>
  );
}

export default ItineraryCards;