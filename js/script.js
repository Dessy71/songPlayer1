const wrapper = document.querySelector(".wrapper");
const musicImg = wrapper.querySelector(".img-area img");
const musicName = wrapper.querySelector(".song-details .name");
const musicArtist = wrapper.querySelector(".song-details .artist");
const playPauseBtn = wrapper.querySelector(".play-pause");
const prevBtn = wrapper.querySelector("#prev");
const nextBtn = wrapper.querySelector("#next");
const mainAudio = wrapper.querySelector("#main-audio");
const progressArea = wrapper.querySelector(".progress-area");
const progressBar = progressArea.querySelector(".progress-bar");
const musicList = wrapper.querySelector(".music-list");
const moreMusicBtn = wrapper.querySelector("#more-music");
const closemoreMusic = musicList.querySelector("#close");
const downloadButton = document.querySelector("#download");
const repeatPlaylistBtn = document.getElementById("repeat-plist");
let repeatState = "all"; // Initial state

mainAudio.addEventListener("ended", playNext);

function playNext() {
  nextMusic();
}



let musicIndex = Math.floor((Math.random() * allMusic.length) + 1);
let isMusicPaused = true;

window.addEventListener("load", () => {
  loadMusic(musicIndex);
  playingSong();
  
});

function loadMusic(indexNumb) {
  musicName.innerText = allMusic[indexNumb - 1].name;
  musicArtist.innerText = allMusic[indexNumb - 1].artist;
  musicImg.src = `images/${allMusic[indexNumb - 1].img}`;

  mainAudio.src = `songs/${allMusic[indexNumb - 1].src}.mp3`;

  // Update the download button's href
  const musicSrc = allMusic[indexNumb - 1].src;
  const downloadURL = `songs/${musicSrc}.mp3`;
  downloadButton.href = downloadURL;
  downloadButton.setAttribute("download", `${musicSrc}.mp3`);
}

// Play music function
function playMusic() {
  wrapper.classList.add("paused");
  playPauseBtn.querySelector("i").innerText = "pause";
  mainAudio.play();
}

// Pause music function
function pauseMusic() {
  wrapper.classList.remove("paused");
  playPauseBtn.querySelector("i").innerText = "play_arrow";
  mainAudio.pause();
}

// Previous music function
function prevMusic() {
  musicIndex--;
  musicIndex < 1 ? musicIndex = allMusic.length : musicIndex = musicIndex;
  loadMusic(musicIndex);
  playMusic();
  playingSong();
}

// Next music function
function nextMusic() {
  musicIndex++;
  musicIndex > allMusic.length ? musicIndex = 1 : musicIndex = musicIndex;
  loadMusic(musicIndex);
  playMusic();
  playingSong();
}

// Play or pause button event
playPauseBtn.addEventListener("click", () => {
  const isMusicPlay = wrapper.classList.contains("paused");
  isMusicPlay ? pauseMusic() : playMusic();
  playingSong();
});

// Previous music button event
prevBtn.addEventListener("click", () => {
  prevMusic();
});

// Next music button event
nextBtn.addEventListener("click", () => {
  nextMusic();
});

// Update progress bar width according to music current time
mainAudio.addEventListener("timeupdate", (e) => {
  const currentTime = e.target.currentTime;
  const duration = e.target.duration;
  let progressWidth = (currentTime / duration) * 100;
  progressBar.style.width = `${progressWidth}%`;

  let musicCurrentTime = wrapper.querySelector(".current-time");
  musicCurrentTime.innerText = formatTime(currentTime);

  let musicDuration = wrapper.querySelector(".max-duration");
  musicDuration.innerText = formatTime(duration);
});

// Format time in minutes and seconds
function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  return formattedTime;
}

// Update playing song current time
function updateCurrentTime() {
  const currentTime = mainAudio.currentTime;
  const musicCurrentTime = wrapper.querySelector(".current-time");
  musicCurrentTime.innerText = formatTime(currentTime);
}

// Update playing song duration
function updateDuration() {
  const duration = mainAudio.duration;
  const musicDuration = wrapper.querySelector(".max-duration");
  musicDuration.innerText = formatTime(duration);
}

// Update playing song
function playingSong() {
  const allLiTag = ulTag.querySelectorAll("li");

  for (let j = 0; j < allLiTag.length; j++) {
    let audioTag = allLiTag[j].querySelector(".audio-duration");

    if (allLiTag[j].classList.contains("playing")) {
      allLiTag[j].classList.remove("playing");
      let adDuration = audioTag.getAttribute("t-duration");
      audioTag.innerText = adDuration;
    }

    if (allLiTag[j].getAttribute("li-index") == musicIndex) {
      allLiTag[j].classList.add("playing");
      audioTag.innerText = "Playing";
    }

    allLiTag[j].setAttribute("onclick", "clicked(this)");
  }
}

// Particular li clicked function
function clicked(element) {
  let getLiIndex = element.getAttribute("li-index");
  musicIndex = getLiIndex;
  loadMusic(musicIndex);
  playMusic();
  playingSong();
}

// Code for what to do after song ended
mainAudio.addEventListener("ended", () => {
  let getText = repeatPlaylistBtn.innerText;
  switch (getText) {
    case "repeat":
      nextMusic();
      break;
    case "repeat_one":
      mainAudio.currentTime = 0;
      loadMusic(musicIndex);
      playMusic();
      break;
    case "shuffle":
      if (shuffleState) {
        let randIndex;
        do {
          randIndex = Math.floor((Math.random() * allMusic.length) + 1);
        } while (musicIndex == randIndex);
        musicIndex = randIndex;
      } else {
        nextMusic();
      }
      loadMusic(musicIndex);
      playMusic();
      playingSong();
      break;
  }
});

// Show music list onclick of music icon
moreMusicBtn.addEventListener("click", () => {
  musicList.classList.toggle("show");
});

closemoreMusic.addEventListener("click", () => {
  moreMusicBtn.click();
});

const ulTag = wrapper.querySelector("ul");

// Create li tags according to array length for list
for (let i = 0; i < allMusic.length; i++) {
  let liTag = `<li data-index="${i}" class="music-item">
                <div class="row">
                  <span>${allMusic[i].name}</span>
                  <p>${allMusic[i].artist}</p>
                </div>
                <span class="audio-duration">3:40</span>
                <audio class="music-audio" src="songs/${allMusic[i].src}.mp3"></audio>
              </li>`;
  ulTag.insertAdjacentHTML("beforeend", liTag);
}

// Update the audio duration and interaction
const musicItems = document.querySelectorAll('.music-item');

musicItems.forEach((item, index) => {
  const audioTag = item.querySelector('.music-audio');
  const audioDurationTag = item.querySelector('.audio-duration');

  audioTag.addEventListener('loadeddata', () => {
    const duration = audioTag.duration;
    audioDurationTag.innerText = formatTime(duration);
    audioDurationTag.setAttribute('t-duration', formatTime(duration));
  });

  item.addEventListener('click', () => {
    musicIndex = index + 1;
    loadMusic(musicIndex);
    playMusic();
    playingSong();
  });
});

// Download button click event
downloadButton.addEventListener("click", (event) => {
  event.preventDefault(); // Prevent default behavior
  const downloadURL = downloadButton.href;
  const link = document.createElement("a");
  link.href = downloadURL;
  link.download = downloadURL.split("/").pop(); // Set the download filename
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.addEventListener("DOMContentLoaded", function () {
  const popup = document.querySelector(".popup");
  const instructions = document.querySelector(".instructions");

  // Show the popup initially after 10 minutes
  setTimeout(function () {
    popup.style.display = "block";
  }, 3 * 60 * 1000);

  // Handle 'Not Ready' button click
  popup.addEventListener("click", function () {
    popup.style.display = "none";
    // Show the popup again after 30 seconds
    setTimeout(function () {
      popup.style.display = "block";
    }, 30 * 60 * 1000);
  });
});

const searchInput = document.getElementById("search-input");
const searchSuggestions = document.getElementById("search-suggestions");

searchInput.addEventListener("input", handleSearchInput);

function handleSearchInput() {
  const searchText = searchInput.value.trim().toLowerCase();
  const filteredMusic = allMusic.filter((music) => {
    return music.name.toLowerCase().includes(searchText);
  });

  if (searchText === "") {
    searchSuggestions.style.display = "none";
  } else {
    searchSuggestions.style.display = "block";
    displaySuggestions(filteredMusic);
  }
}

function displaySuggestions(suggestions) {
  searchSuggestions.innerHTML = "";

  if (suggestions.length === 0) {
    searchSuggestions.innerHTML = '<div class="suggestion">No matching songs found.</div>';
  } else {
    suggestions.forEach((music) => {
      const suggestion = document.createElement("div");
      suggestion.className = "suggestion";
      suggestion.textContent = music.name;
      suggestion.addEventListener("click", () => {
        loadMusic(allMusic.indexOf(music) + 1);
        playMusic();
        playingSong();
        searchInput.value = "";
        searchSuggestions.style.display = "none";
      });
      searchSuggestions.appendChild(suggestion);
    });
  }
}



// Drag and seek within the song
progressArea.addEventListener("click", (e) => {
  const progressWidth = progressArea.clientWidth;
  const clickedOffsetX = e.offsetX;
  mainAudio.currentTime = (clickedOffsetX / progressWidth) * mainAudio.duration;
});

// Other functions and event listeners...
