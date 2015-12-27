module.exports = {
    admin_user: 'admin', // PLEASE CHANGE IN PRODUCTION
    admin_password: 'THIS_IS_NOT_SAFE', // PLEASE CHANGE IN PRODUCTION
    db_connection: 'localhost/media-diaries',
    db_collection: 'entries',
    use_image_magick: true,
    client_config: {
        /* GENERAL CONFIGURATION */
        
        diary_title: 'Mobile Media Diaries',
        passcode_prompt_message: "Please enter the authentication code given by the researcher to access the diary",
        show_generate_passcode: true, // Show the 'Generate passcode' button on login page
        question_list_title: 'Please tell us about your experience…',
        diary_questions: "data/diaryquestions.json",
            /* DIARY QUESTIONS FILE URL CAN BE REPLACED BY A LIST OF A FORMAT MATCHING THAT OF THE EXAMPLE FILE */
        min_entries: 5,
        max_entries: false,
        show_generate_passcode: true, // Show the 'Generate passcode' button on login page
        generate_passcode_label: "Generate a new passcode",
        
        /* IMAGE BLOCK CONFIGURATION */
        show_media_block: true,
        media_block_title: "Share an image",
        
        /* LOCATION BLOCK CONFIGURATION */
        show_location_block: true,
        location_block_title: "Where was it?",
        locations: "data/locations.json",
            /* LOCATION LIST FILE URL CAN BE REPLACED BY A LIST OF A FORMAT MATCHING THAT OF THE EXAMPLE FILE */
        map_coords: {
            latitude: 51.50722,
            longitude: -0.12750,
            zoom: 11
        },
        use_geolocation: true,
        show_locations_on_map: true,
            /* If the location list is too large, you may want to hide locations from the map */
        
        /* CALENDAR BLOCK CONFIGURATION */
        show_calendar_block: true,
        calendar_block_title: "Which day is it about?",
        start_date: '2015-12-01',
        end_date: '2016-01-31',
        
        /* EMOJI BLOCK CONFIGURATION */
        show_emoji_block: true,
        emoji_block_title: "What emotions relate to this moment?",
        emojis: [
            "\ud83d\ude03", // 0x1f603 SMILING FACE WITH OPEN MOUTH
            "\ud83d\ude1e", // 0x1f61e DISAPPOINTED FACE
            "\ud83d\ude20", // 0x1F620 ANGRY FACE
            "\ud83d\ude22", // 0x1f622 CRYING FACE
            "\ud83d\ude28", // 0x1f628 FEARFUL FACE
            "\ud83d\ude33", // 0x1f633 FLUSHED FACE
        ], // can be replaced by a JSON file containing the same data
        
        /* COMMENT BLOCK CONFIGURATION */
        show_comment_block: true,
        comment_block_title: "Can you tell us more about it?",
        comment_box_placeholder: "Type a comment here",
    }
};
